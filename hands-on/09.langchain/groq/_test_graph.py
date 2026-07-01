import sys, os, time, json
sys.stdout.reconfigure(encoding="utf-8")
sys.path.insert(0, r"C:\Users\hiond\workspace\aistudy\hands-on\09.langchain\common")
from dotenv import load_dotenv
load_dotenv(r"C:\Users\hiond\workspace\aistudy\hands-on\.env")

from langchain_groq import ChatGroq
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages
from typing import Annotated
from typing_extensions import TypedDict
from tools import TRAVEL_TOOLS
from prompts import SYSTEM_PROMPT

MODEL_NAME = "openai/gpt-oss-120b"
WINDOW_SIZE = 3
MAX_TOKENS = 8000

class TravelState(TypedDict):
    messages: Annotated[list, add_messages]
    summary: str

def build_agent():
    from llm import require_api_key
    api_key = require_api_key("GROQ_API_KEY")
    llm = ChatGroq(model=MODEL_NAME, api_key=api_key, max_tokens=MAX_TOKENS, temperature=0)
    llm_with_tools = llm.bind_tools(TRAVEL_TOOLS)
    tools_map = {t.name: t for t in TRAVEL_TOOLS}

    def chatbot_node(state):
        t0 = time.time()
        summary = state.get("summary", "")
        system_content = SYSTEM_PROMPT + (f"\n\n[이전 대화 요약]\n{summary}" if summary else "")
        all_msgs = state["messages"]
        keep = WINDOW_SIZE * 2
        windowed = all_msgs[-keep:] if len(all_msgs) > keep else all_msgs
        messages = [SystemMessage(content=system_content)] + list(windowed)
        response = llm_with_tools.invoke(messages)
        if response.content is None:
            response.content = ""
        print(f"  chatbot_node: {time.time()-t0:.1f}s | tool_calls={len(response.tool_calls)} | content_len={len(response.content)}")
        return {"messages": [response]}

    def tool_node(state):
        t0 = time.time()
        last_ai = state["messages"][-1]
        results = []
        for tc in last_ai.tool_calls:
            fn = tools_map.get(tc["name"])
            result = fn.invoke(tc["args"]) if fn else {"error": f"Unknown: {tc['name']}"}
            print(f"  tool: {tc['name']}({tc['args']}) -> ok={not isinstance(result, dict) or 'error' not in result}")
            results.append(ToolMessage(content=json.dumps(result, ensure_ascii=False), tool_call_id=tc["id"]))
        print(f"  tool_node: {time.time()-t0:.1f}s | {len(results)} tools executed")
        return {"messages": results}

    def summarize_node(state):
        msgs = state["messages"]
        keep = WINDOW_SIZE * 2
        if len(msgs) <= keep:
            return {}
        return {}

    def should_continue(state):
        last = state["messages"][-1]
        if isinstance(last, AIMessage) and last.tool_calls:
            return "tools"
        return "summarize"

    builder = StateGraph(TravelState)
    builder.add_node("chatbot", chatbot_node)
    builder.add_node("tools", tool_node)
    builder.add_node("summarize", summarize_node)
    builder.add_edge(START, "chatbot")
    builder.add_conditional_edges("chatbot", should_continue, {"tools": "tools", "summarize": "summarize"})
    builder.add_edge("tools", "chatbot")
    builder.add_edge("summarize", END)
    return builder.compile(checkpointer=MemorySaver())

t_start = time.time()
print("Building agent...")
agent = build_agent()
print(f"Agent built: {time.time()-t_start:.1f}s")

print("\nInvoking agent with '서울'...")
t1 = time.time()
config = {"configurable": {"thread_id": "test-1"}}
result = agent.invoke({"messages": [HumanMessage(content="서울")], "summary": ""}, config)
elapsed = time.time() - t1

print(f"\nTotal invoke time: {elapsed:.1f}s")
for msg in reversed(result["messages"]):
    if isinstance(msg, AIMessage):
        print(f"\n--- Final AI response (first 500 chars) ---\n{msg.content[:500]}")
        break
