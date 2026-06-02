import React, { useState } from 'react';

const RAGConceptDiagram = () => {
  const [activeTab, setActiveTab] = useState('overview');

  const tabs = [
    { id: 'overview', label: '전체 구조' },
    { id: 'basic', label: 'Basic RAG' },
    { id: 'querytransform', label: 'Query Transform' },
    { id: 'selfrag', label: 'Self-RAG' },
    { id: 'crag', label: 'CRAG' },
    { id: 'adaptive', label: 'Adaptive RAG' },
    { id: 'agentic', label: 'Agentic RAG' },
  ];

  const Arrow = ({ direction = 'down', className = '' }) => {
    const arrows = {
      down: '↓',
      right: '→',
      left: '←',
      bidirectional: '↔',
      curved: '↴',
    };
    return <span className={`text-xl font-bold text-gray-500 ${className}`}>{arrows[direction]}</span>;
  };

  const Box = ({ children, color = 'blue', size = 'md', className = '' }) => {
    const colors = {
      blue: 'bg-blue-100 border-blue-400 text-blue-800',
      green: 'bg-green-100 border-green-400 text-green-800',
      purple: 'bg-purple-100 border-purple-400 text-purple-800',
      orange: 'bg-orange-100 border-orange-400 text-orange-800',
      red: 'bg-red-100 border-red-400 text-red-800',
      gray: 'bg-gray-100 border-gray-400 text-gray-700',
      yellow: 'bg-yellow-100 border-yellow-400 text-yellow-800',
      pink: 'bg-pink-100 border-pink-400 text-pink-800',
      teal: 'bg-teal-100 border-teal-400 text-teal-800',
      indigo: 'bg-indigo-100 border-indigo-400 text-indigo-800',
    };
    const sizes = {
      xs: 'px-1 py-0.5 text-xs',
      sm: 'px-2 py-1 text-xs',
      md: 'px-3 py-2 text-sm',
      lg: 'px-4 py-3 text-base',
    };
    return (
      <div className={`border-2 rounded-lg font-medium text-center ${colors[color]} ${sizes[size]} ${className}`}>
        {children}
      </div>
    );
  };

  const DiamondBox = ({ children, color = 'yellow' }) => {
    const colors = {
      yellow: 'bg-yellow-100 border-yellow-400 text-yellow-800',
      orange: 'bg-orange-100 border-orange-400 text-orange-800',
    };
    return (
      <div className={`border-2 rounded-lg px-3 py-2 text-sm font-medium text-center transform rotate-0 ${colors[color]}`}>
        <div className="flex items-center justify-center">
          <span className="mr-1">◇</span>
          {children}
        </div>
      </div>
    );
  };

  // Overview Diagram - Updated
  const OverviewDiagram = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-bold text-center text-gray-800 mb-4">RAG 전체 구조 및 계층</h3>
      
      {/* Two-Level Structure */}
      <div className="bg-gradient-to-b from-purple-50 to-white border-2 border-purple-300 rounded-xl p-5">
        <h4 className="text-sm font-bold text-purple-700 mb-4 text-center">🏗️ Architecture Patterns (아키텍처 패턴)</h4>
        <p className="text-xs text-gray-500 text-center mb-4">전체 RAG 파이프라인의 흐름과 제어 방식 정의</p>
        
        <div className="flex justify-center items-center gap-3 flex-wrap">
          <Box color="blue" size="md">Self-RAG<br/><span className="text-xs font-normal">검색 판단</span></Box>
          <Box color="green" size="md">CRAG<br/><span className="text-xs font-normal">결과 교정</span></Box>
          <Box color="orange" size="md">Adaptive<br/><span className="text-xs font-normal">전략 선택</span></Box>
          <Box color="purple" size="md">Agentic<br/><span className="text-xs font-normal">자율 행동</span></Box>
        </div>
      </div>

      <div className="flex justify-center">
        <div className="text-gray-400 text-sm">▼ 조합하여 사용 ▼</div>
      </div>

      {/* Techniques Level */}
      <div className="bg-gradient-to-b from-teal-50 to-white border-2 border-teal-300 rounded-xl p-5">
        <h4 className="text-sm font-bold text-teal-700 mb-4 text-center">🔧 Techniques (세부 기법)</h4>
        <p className="text-xs text-gray-500 text-center mb-4">RAG 파이프라인 각 단계의 최적화 기법</p>
        
        <div className="grid grid-cols-3 gap-4">
          {/* Pre-Retrieval */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="text-xs font-bold text-blue-700 mb-2 text-center">📝 Pre-Retrieval</div>
            <div className="space-y-1">
              <Box color="blue" size="xs">Query Rewriting</Box>
              <Box color="blue" size="xs">Multi-Query</Box>
              <Box color="blue" size="xs">HyDE</Box>
              <Box color="blue" size="xs">Step-Back</Box>
            </div>
          </div>
          
          {/* Retrieval */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="text-xs font-bold text-green-700 mb-2 text-center">🔍 Retrieval</div>
            <div className="space-y-1">
              <Box color="green" size="xs">Dense Retrieval</Box>
              <Box color="green" size="xs">Sparse (BM25)</Box>
              <Box color="green" size="xs">Hybrid Search</Box>
              <Box color="green" size="xs">Graph RAG</Box>
            </div>
          </div>
          
          {/* Post-Retrieval */}
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
            <div className="text-xs font-bold text-orange-700 mb-2 text-center">📊 Post-Retrieval</div>
            <div className="space-y-1">
              <Box color="orange" size="xs">Re-ranking</Box>
              <Box color="orange" size="xs">Compression</Box>
              <Box color="orange" size="xs">Filtering</Box>
              <Box color="orange" size="xs">Fusion</Box>
            </div>
          </div>
        </div>
      </div>

      {/* Pipeline Flow */}
      <div className="bg-gray-50 rounded-xl p-4">
        <h4 className="text-sm font-semibold text-gray-600 mb-3 text-center">RAG 파이프라인 흐름</h4>
        <div className="flex items-center justify-between text-xs">
          <Box color="gray" size="sm">Query</Box>
          <Arrow direction="right" />
          <Box color="blue" size="sm">Query<br/>Transform</Box>
          <Arrow direction="right" />
          <Box color="green" size="sm">Retrieve</Box>
          <Arrow direction="right" />
          <Box color="orange" size="sm">Re-rank</Box>
          <Arrow direction="right" />
          <Box color="purple" size="sm">Generate</Box>
          <Arrow direction="right" />
          <Box color="gray" size="sm">Response</Box>
        </div>
      </div>

      {/* Feature Comparison */}
      <div className="bg-gray-50 rounded-xl p-4">
        <h4 className="text-sm font-semibold text-gray-600 mb-3">아키텍처 패턴 비교</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 px-2">구분</th>
                <th className="text-center py-2 px-2">Self-RAG</th>
                <th className="text-center py-2 px-2">CRAG</th>
                <th className="text-center py-2 px-2">Adaptive</th>
                <th className="text-center py-2 px-2">Agentic</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b">
                <td className="py-2 px-2 font-medium">핵심 질문</td>
                <td className="text-center py-2 px-2 text-blue-600">검색할까?</td>
                <td className="text-center py-2 px-2 text-green-600">결과 맞나?</td>
                <td className="text-center py-2 px-2 text-orange-600">어떤 전략?</td>
                <td className="text-center py-2 px-2 text-purple-600">어떻게 행동?</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 px-2 font-medium">작동 시점</td>
                <td className="text-center py-2 px-2">검색 전</td>
                <td className="text-center py-2 px-2">검색 후</td>
                <td className="text-center py-2 px-2">라우팅 시</td>
                <td className="text-center py-2 px-2">전체 과정</td>
              </tr>
              <tr>
                <td className="py-2 px-2 font-medium">자율성</td>
                <td className="text-center py-2 px-2">⭐⭐</td>
                <td className="text-center py-2 px-2">⭐⭐</td>
                <td className="text-center py-2 px-2">⭐⭐⭐</td>
                <td className="text-center py-2 px-2">⭐⭐⭐⭐⭐</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  // Query Transformation Diagram - NEW
  const QueryTransformDiagram = () => (
    <div className="space-y-5">
      <h3 className="text-lg font-bold text-center text-teal-800">Query Transformation 기법</h3>
      <p className="text-sm text-gray-600 text-center mb-4">검색 전 쿼리를 변환하여 검색 품질 향상</p>
      
      {/* Where it fits */}
      <div className="bg-gray-50 rounded-xl p-4 mb-4">
        <div className="flex items-center justify-center text-xs gap-2">
          <Box color="gray" size="sm">Query</Box>
          <Arrow direction="right" />
          <div className="border-2 border-teal-400 rounded-lg p-2 bg-teal-50">
            <Box color="teal" size="sm">🔄 Query Transform</Box>
          </div>
          <Arrow direction="right" />
          <Box color="green" size="sm">Retriever</Box>
          <Arrow direction="right" />
          <Box color="gray" size="sm">...</Box>
        </div>
      </div>

      {/* Four Techniques Grid */}
      <div className="grid grid-cols-2 gap-4">
        
        {/* Query Rewriting */}
        <div className="bg-blue-50 border-2 border-blue-300 rounded-xl p-4">
          <h4 className="text-sm font-bold text-blue-700 mb-3 flex items-center">
            <span className="mr-2">✏️</span> Query Rewriting
          </h4>
          <div className="text-xs text-gray-600 mb-3">질문 → 명확한 질문</div>
          
          <div className="bg-white rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Box color="gray" size="xs" className="flex-1">"그거 어떻게 해?"</Box>
            </div>
            <div className="text-center"><Arrow direction="down" /></div>
            <div className="flex items-center gap-2">
              <Box color="blue" size="xs" className="flex-1">"Python에서 리스트 정렬하는 방법"</Box>
            </div>
          </div>
          
          <div className="mt-3 text-xs text-gray-500">
            <strong>목적:</strong> 모호한 질문을 검색에 유리하게 재작성
          </div>
        </div>

        {/* Multi-Query */}
        <div className="bg-green-50 border-2 border-green-300 rounded-xl p-4">
          <h4 className="text-sm font-bold text-green-700 mb-3 flex items-center">
            <span className="mr-2">🔀</span> Multi-Query
          </h4>
          <div className="text-xs text-gray-600 mb-3">질문 → 여러 질문</div>
          
          <div className="bg-white rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Box color="gray" size="xs" className="flex-1">"RAG 장단점"</Box>
            </div>
            <div className="text-center"><Arrow direction="down" /></div>
            <div className="space-y-1">
              <Box color="green" size="xs">"RAG의 장점은?"</Box>
              <Box color="green" size="xs">"RAG의 단점은?"</Box>
              <Box color="green" size="xs">"RAG 사용시 고려사항"</Box>
            </div>
          </div>
          
          <div className="mt-3 text-xs text-gray-500">
            <strong>목적:</strong> 여러 관점으로 검색 범위 확장
          </div>
        </div>

        {/* HyDE */}
        <div className="bg-purple-50 border-2 border-purple-300 rounded-xl p-4">
          <h4 className="text-sm font-bold text-purple-700 mb-3 flex items-center">
            <span className="mr-2">💭</span> HyDE
          </h4>
          <div className="text-xs text-gray-600 mb-3">질문 → 가상 답변 → 검색</div>
          
          <div className="bg-white rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Box color="gray" size="xs" className="flex-1">"벡터 DB란?"</Box>
            </div>
            <div className="text-center"><Arrow direction="down" /></div>
            <div className="flex items-center gap-2">
              <Box color="yellow" size="xs" className="flex-1">LLM이 가상 답변 생성</Box>
            </div>
            <div className="text-center"><Arrow direction="down" /></div>
            <div className="flex items-center gap-2">
              <Box color="purple" size="xs" className="flex-1">가상 답변으로 유사 문서 검색</Box>
            </div>
          </div>
          
          <div className="mt-3 text-xs text-gray-500">
            <strong>목적:</strong> 질문-문서 간 시맨틱 갭 해소
          </div>
        </div>

        {/* Step-Back */}
        <div className="bg-orange-50 border-2 border-orange-300 rounded-xl p-4">
          <h4 className="text-sm font-bold text-orange-700 mb-3 flex items-center">
            <span className="mr-2">🔭</span> Step-Back Prompting
          </h4>
          <div className="text-xs text-gray-600 mb-3">구체적 → 추상적</div>
          
          <div className="bg-white rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Box color="gray" size="xs" className="flex-1">"iPhone 15 배터리 용량"</Box>
            </div>
            <div className="text-center"><Arrow direction="down" /></div>
            <div className="flex items-center gap-2">
              <Box color="orange" size="xs" className="flex-1">"스마트폰 배터리 기술 동향"</Box>
            </div>
            <div className="text-center text-xs text-gray-400">+ 원본 질문 함께 검색</div>
          </div>
          
          <div className="mt-3 text-xs text-gray-500">
            <strong>목적:</strong> 추상화로 더 넓은 맥락에서 검색
          </div>
        </div>
      </div>

      {/* Comparison Table */}
      <div className="bg-white border rounded-xl p-4 mt-4">
        <h4 className="text-sm font-semibold text-gray-700 mb-3">기법별 비교</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left py-2 px-3">기법</th>
                <th className="text-left py-2 px-3">변환</th>
                <th className="text-left py-2 px-3">적합한 상황</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b">
                <td className="py-2 px-3 font-medium text-blue-700">Query Rewriting</td>
                <td className="py-2 px-3">질문 → 명확한 질문</td>
                <td className="py-2 px-3">모호하거나 구어체 질문</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 px-3 font-medium text-green-700">Multi-Query</td>
                <td className="py-2 px-3">질문 → 여러 질문</td>
                <td className="py-2 px-3">복합적 질문, 비교 분석</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 px-3 font-medium text-purple-700">HyDE</td>
                <td className="py-2 px-3">질문 → 가상 답변</td>
                <td className="py-2 px-3">질문-문서 형식 차이가 클 때</td>
              </tr>
              <tr>
                <td className="py-2 px-3 font-medium text-orange-700">Step-Back</td>
                <td className="py-2 px-3">구체적 → 추상적</td>
                <td className="py-2 px-3">배경 지식이 필요한 질문</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Tips */}
      <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-teal-800 mb-2">💡 실무 팁</h4>
        <ul className="text-xs text-gray-700 space-y-1">
          <li>• Query Transformation은 <strong>어떤 RAG 아키텍처와도 결합 가능</strong></li>
          <li>• 복잡한 질문에는 <strong>Multi-Query + Re-ranking</strong> 조합 추천</li>
          <li>• HyDE는 LLM 호출이 추가되므로 <strong>레이턴시 고려</strong> 필요</li>
          <li>• Agentic RAG에서는 에이전트가 <strong>상황에 맞는 기법을 자동 선택</strong></li>
        </ul>
      </div>
    </div>
  );

  // Basic RAG Diagram
  const BasicRAGDiagram = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-center text-gray-800">Basic RAG 흐름도</h3>
      <p className="text-sm text-gray-600 text-center mb-4">단순 검색 → 생성의 단방향 파이프라인</p>
      
      <div className="flex flex-col items-center space-y-3">
        <Box color="gray" size="lg">📝 Query (사용자 질문)</Box>
        <Arrow direction="down" />
        <Box color="blue" size="lg">🔍 Retriever (검색기)</Box>
        <div className="text-xs text-gray-500">Vector DB에서 관련 문서 검색</div>
        <Arrow direction="down" />
        <Box color="green" size="lg">📚 Retrieved Documents</Box>
        <Arrow direction="down" />
        <Box color="purple" size="lg">🤖 LLM Generator</Box>
        <div className="text-xs text-gray-500">Query + Documents → 응답 생성</div>
        <Arrow direction="down" />
        <Box color="orange" size="lg">💬 Response (응답)</Box>
      </div>

      <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-yellow-800 mb-2">⚠️ Basic RAG의 한계</h4>
        <ul className="text-xs text-gray-700 space-y-1">
          <li>• 항상 검색 수행 (불필요한 검색)</li>
          <li>• 검색 결과 품질 검증 없음</li>
          <li>• 단일 검색 전략만 사용</li>
          <li>• 자기 교정 메커니즘 없음</li>
          <li>• Query Transformation 없음</li>
        </ul>
      </div>
    </div>
  );

  // Self-RAG Diagram
  const SelfRAGDiagram = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-center text-blue-800">Self-RAG 흐름도</h3>
      <p className="text-sm text-gray-600 text-center mb-4">Reflection Token으로 검색 필요성 스스로 판단</p>
      
      <div className="flex flex-col items-center space-y-3">
        <Box color="gray" size="lg">📝 Query</Box>
        <Arrow direction="down" />
        
        <div className="bg-blue-50 border-2 border-blue-300 rounded-xl p-4 w-full max-w-md">
          <div className="text-center mb-3">
            <DiamondBox color="yellow">🤔 검색 필요? (Reflection Token)</DiamondBox>
          </div>
          
          <div className="flex justify-around items-start">
            <div className="flex flex-col items-center space-y-2">
              <span className="text-green-600 font-bold text-sm">✓ Yes</span>
              <Arrow direction="down" />
              <Box color="blue" size="sm">🔍 Retrieve</Box>
              <Arrow direction="down" />
              <Box color="green" size="sm">📚 Documents</Box>
            </div>
            
            <div className="flex flex-col items-center space-y-2">
              <span className="text-red-600 font-bold text-sm">✗ No</span>
              <Arrow direction="down" />
              <Box color="gray" size="sm">Skip Retrieval</Box>
              <div className="text-xs text-gray-500 text-center">파라메트릭<br/>지식 사용</div>
            </div>
          </div>
        </div>
        
        <Arrow direction="down" />
        <Box color="purple" size="lg">🤖 Generate Response</Box>
        <Arrow direction="down" />
        
        <div className="bg-blue-50 border-2 border-blue-300 rounded-xl p-4 w-full max-w-md">
          <DiamondBox color="yellow">🔄 결과 만족? (Self-Critique)</DiamondBox>
          <div className="flex justify-around mt-3">
            <div className="text-center">
              <span className="text-green-600 font-bold text-sm">✓ Yes</span>
              <div className="text-xs">→ 출력</div>
            </div>
            <div className="text-center">
              <span className="text-red-600 font-bold text-sm">✗ No</span>
              <div className="text-xs">→ 재검색/재생성</div>
            </div>
          </div>
        </div>
        
        <Arrow direction="down" />
        <Box color="orange" size="lg">💬 Response</Box>
      </div>

      <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-blue-800 mb-2">💡 Self-RAG 핵심</h4>
        <ul className="text-xs text-gray-700 space-y-1">
          <li>• <strong>Reflection Tokens</strong>: [Retrieve], [IsRel], [IsSup], [IsUse]</li>
          <li>• 검색 여부를 <strong>스스로 결정</strong></li>
          <li>• On-demand Retrieval (필요시에만 검색)</li>
        </ul>
      </div>
    </div>
  );

  // CRAG Diagram
  const CRAGDiagram = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-center text-green-800">Corrective RAG 흐름도</h3>
      <p className="text-sm text-gray-600 text-center mb-4">검색 결과의 관련성을 평가하고 교정</p>
      
      <div className="flex flex-col items-center space-y-3">
        <Box color="gray" size="lg">📝 Query</Box>
        <Arrow direction="down" />
        <Box color="blue" size="lg">🔍 Retrieve (항상 수행)</Box>
        <Arrow direction="down" />
        <Box color="green" size="md">📚 Retrieved Documents</Box>
        <Arrow direction="down" />
        
        <div className="bg-green-50 border-2 border-green-300 rounded-xl p-4 w-full max-w-lg">
          <div className="text-center mb-3">
            <DiamondBox color="yellow">⚖️ 관련성 평가 (Relevance Evaluator)</DiamondBox>
          </div>
          
          <div className="flex justify-around items-start">
            <div className="flex flex-col items-center space-y-2 flex-1">
              <span className="text-green-600 font-bold text-sm">Correct ✓</span>
              <div className="text-xs text-gray-500">관련성 높음</div>
              <Arrow direction="down" />
              <Box color="green" size="sm">Knowledge<br/>Refinement</Box>
            </div>
            
            <div className="flex flex-col items-center space-y-2 flex-1">
              <span className="text-yellow-600 font-bold text-sm">Ambiguous ⚠️</span>
              <div className="text-xs text-gray-500">불확실</div>
              <Arrow direction="down" />
              <Box color="yellow" size="sm">Query<br/>Rewrite</Box>
            </div>
            
            <div className="flex flex-col items-center space-y-2 flex-1">
              <span className="text-red-600 font-bold text-sm">Incorrect ✗</span>
              <div className="text-xs text-gray-500">관련성 낮음</div>
              <Arrow direction="down" />
              <Box color="red" size="sm">Web Search<br/>Fallback</Box>
            </div>
          </div>
        </div>
        
        <Arrow direction="down" />
        <Box color="purple" size="lg">🤖 Generate with Corrected Context</Box>
        <Arrow direction="down" />
        <Box color="orange" size="lg">💬 Response</Box>
      </div>

      <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-green-800 mb-2">💡 CRAG 핵심</h4>
        <ul className="text-xs text-gray-700 space-y-1">
          <li>• 검색은 <strong>항상 수행</strong> (Self-RAG와 차이점)</li>
          <li>• 검색 결과의 <strong>품질을 검증</strong>하고 교정</li>
          <li>• 필요시 웹 검색으로 폴백</li>
        </ul>
      </div>
    </div>
  );

  // Adaptive RAG Diagram
  const AdaptiveRAGDiagram = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-center text-orange-800">Adaptive RAG 흐름도</h3>
      <p className="text-sm text-gray-600 text-center mb-4">쿼리 복잡도에 따라 전략을 동적으로 선택</p>
      
      <div className="flex flex-col items-center space-y-3">
        <Box color="gray" size="lg">📝 Query</Box>
        <Arrow direction="down" />
        
        <div className="bg-orange-50 border-2 border-orange-300 rounded-xl p-4 w-full max-w-lg">
          <div className="text-center mb-3">
            <Box color="orange" size="md">🎯 Query Complexity Classifier</Box>
          </div>
          
          <div className="flex justify-around items-start mt-4">
            <div className="flex flex-col items-center space-y-2">
              <span className="text-blue-600 font-bold text-sm">Simple</span>
              <div className="text-xs text-gray-500">"2+2는?"</div>
              <Arrow direction="down" />
              <Box color="blue" size="sm">No Retrieval<br/>(LLM만)</Box>
            </div>
            
            <div className="flex flex-col items-center space-y-2">
              <span className="text-green-600 font-bold text-sm">Medium</span>
              <div className="text-xs text-gray-500">"회사 정책은?"</div>
              <Arrow direction="down" />
              <Box color="green" size="sm">Single-step<br/>RAG</Box>
            </div>
            
            <div className="flex flex-col items-center space-y-2">
              <span className="text-purple-600 font-bold text-sm">Complex</span>
              <div className="text-xs text-gray-500">"비교 분석해줘"</div>
              <Arrow direction="down" />
              <Box color="purple" size="sm">Multi-step<br/>RAG</Box>
            </div>
          </div>
        </div>
        
        <Arrow direction="down" />
        <Box color="purple" size="lg">🤖 Execute Selected Strategy</Box>
        <Arrow direction="down" />
        <Box color="orange" size="lg">💬 Response</Box>
      </div>

      <div className="mt-4 bg-orange-50 border border-orange-200 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-orange-800 mb-2">💡 Adaptive RAG 핵심</h4>
        <ul className="text-xs text-gray-700 space-y-1">
          <li>• <strong>라우터 역할</strong>: 전략 선택에 집중</li>
          <li>• 복잡도별 최적 전략 분기</li>
          <li>• 단순 쿼리는 빠르게, 복잡 쿼리는 정밀하게</li>
        </ul>
      </div>
    </div>
  );

  // Agentic RAG Diagram
  const AgenticRAGDiagram = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-center text-purple-800">Agentic RAG 흐름도</h3>
      <p className="text-sm text-gray-600 text-center mb-4">자율적 에이전트가 계획-실행-평가를 반복</p>
      
      <div className="flex flex-col items-center space-y-3">
        <Box color="gray" size="lg">📝 Query + Goal</Box>
        <Arrow direction="down" />
        
        <div className="bg-purple-50 border-2 border-purple-400 rounded-xl p-4 w-full max-w-xl">
          <div className="text-center mb-4">
            <Box color="purple" size="lg">🤖 Autonomous Agent</Box>
          </div>
          
          {/* Agent Loop */}
          <div className="relative">
            <div className="flex justify-around items-center mb-4">
              <div className="flex flex-col items-center">
                <Box color="blue" size="md">📋 Plan</Box>
                <div className="text-xs text-gray-500 mt-1">목표 분해</div>
              </div>
              <Arrow direction="right" />
              <div className="flex flex-col items-center">
                <Box color="green" size="md">🔧 Select Tool</Box>
                <div className="text-xs text-gray-500 mt-1">도구 선택</div>
              </div>
              <Arrow direction="right" />
              <div className="flex flex-col items-center">
                <Box color="orange" size="md">⚡ Execute</Box>
                <div className="text-xs text-gray-500 mt-1">실행</div>
              </div>
            </div>
            
            <div className="flex justify-center">
              <div className="flex items-center space-x-2">
                <span className="text-purple-500">↺</span>
                <DiamondBox color="yellow">🔄 Evaluate & Replan</DiamondBox>
                <span className="text-purple-500">↻</span>
              </div>
            </div>
          </div>
          
          {/* Available Tools */}
          <div className="mt-4 border-t border-purple-200 pt-4">
            <div className="text-xs text-purple-600 font-semibold mb-2 text-center">🧰 Available Tools</div>
            <div className="flex flex-wrap justify-center gap-2">
              <Box color="teal" size="sm">Query Transform</Box>
              <Box color="blue" size="sm">Self-RAG</Box>
              <Box color="green" size="sm">CRAG</Box>
              <Box color="orange" size="sm">Adaptive</Box>
              <Box color="gray" size="sm">Web Search</Box>
              <Box color="pink" size="sm">Re-ranker</Box>
            </div>
          </div>
        </div>
        
        <Arrow direction="down" />
        <Box color="orange" size="lg">💬 Final Response</Box>
      </div>

      <div className="mt-4 bg-purple-50 border border-purple-200 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-purple-800 mb-2">💡 Agentic RAG 핵심</h4>
        <ul className="text-xs text-gray-700 space-y-1">
          <li>• <strong>자율적 의사결정</strong>: 목표 달성까지 스스로 행동</li>
          <li>• <strong>다중 도구 사용</strong>: Query Transform, Re-ranker 등 포함</li>
          <li>• <strong>반복적 개선</strong>: Plan → Execute → Evaluate 루프</li>
          <li>• 다른 RAG 기법들을 <strong>하위 도구로 활용</strong></li>
        </ul>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'overview': return <OverviewDiagram />;
      case 'basic': return <BasicRAGDiagram />;
      case 'querytransform': return <QueryTransformDiagram />;
      case 'selfrag': return <SelfRAGDiagram />;
      case 'crag': return <CRAGDiagram />;
      case 'adaptive': return <AdaptiveRAGDiagram />;
      case 'agentic': return <AgenticRAGDiagram />;
      default: return <OverviewDiagram />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-center text-gray-800 mb-2">
          RAG 아키텍처 개념도
        </h1>
        <p className="text-sm text-gray-500 text-center mb-6">
          Retrieval-Augmented Generation 유형별 비교
        </p>
        
        {/* Tab Navigation */}
        <div className="flex flex-wrap justify-center gap-2 mb-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-purple-600 text-white shadow-lg'
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        
        {/* Content Area */}
        <div className="bg-white rounded-2xl shadow-xl p-6 min-h-96">
          {renderContent()}
        </div>
        
        {/* Footer */}
        <div className="mt-6 text-center text-xs text-gray-400">
          유니콘주식회사 Boot Camp 교육자료 | AI/ML 엔지니어 한승우(마법사)
        </div>
      </div>
    </div>
  );
};

export default RAGConceptDiagram;