import sys, os
sys.path.insert(0, r"C:\Users\hiond\workspace\aistudy\hands-on\09.langchain\common")
os.environ["PYTHONIOENCODING"] = "utf-8"
from dotenv import load_dotenv
load_dotenv(r"C:\Users\hiond\workspace\aistudy\hands-on\.env")

from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, SystemMessage
from tools import TRAVEL_TOOLS

print("Testing ChatGroq + tool calling...")
llm = ChatGroq(model="openai/gpt-oss-120b", max_tokens=500, temperature=0)
llm_with_tools = llm.bind_tools(TRAVEL_TOOLS)
resp = llm_with_tools.invoke([
    SystemMessage(content="You are a travel planner. Call the get_weather tool."),
    HumanMessage(content="What is the weather in Seoul?")
])
print("content:", repr(resp.content))
print("tool_calls:", len(resp.tool_calls) if resp.tool_calls else 0)
if resp.tool_calls:
    print("first tool:", resp.tool_calls[0]["name"])
    print("args:", resp.tool_calls[0]["args"])
print("DONE")
