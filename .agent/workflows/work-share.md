---
description: 현재 작업의 목표, 진행 상황, 기술적 결정 사항 등을 분석하여 공유 컨텍스트 파일(*.md)에 저장합니다.
---

[Guiding Principle] 이 워크플로우의 목적은 비즈니스 로직과 상태(Status)를 공유하는 것입니다. 코드(Code), 파일명(Filename), 디렉토리 경로(Directory Path) 등의 구체적인 구현체 정보는 공유 파일에 기록하지 마십시오.

1. **Analyze Session Context (세션 분석)**
  - 해당 컨텍스트의 대화 기록과 작업 내용을 분석하여 다음 정보를 추출하세요.
    - Session Date: 현재 날짜 및 시간
    - Objective: 이번 세션의 주요 목표
    - Status: 완료됨 / 진행 중 / 막힘 (이유 포함)
    - Business Logic Changes: (중요: 파일명/코드 금지) 구현한 비즈니스 로직의 '의도'와 '결과'만 요약 기술 (예: "JWT 만료 검증 로직 추가" (O) / "AuthService.ts 수정" (X))
    - Tech Specs: 사용된 라이브러리 버전이나 환경 설정 등 유의사항
    - Have To Know: 다음 에이전트가 이어받아 수행해야 할 구체적인 작업 목록 (비즈니스 관점)

2. **Check & Create Shared Directory (공유 디렉토리 확인)**
  - `list_dir` 도구를 사용하여 `/contexts-space` 하위에 존재하는 모든 디렉토리 목록을 확보하세요.
  - (경로 결정 전략): 확보된 목록 중 현재 작업 기능(예: 로그인)과 의미가 통하는 디렉토리(`auth` 등)를 선택하세요.
  - 만약 적절한 디렉토리가 없다면, 기능의 핵심 단어(예: `payment`)로 **새 디렉토리를 생성(mkdir)**하십시오.
  - 결정된 경로 예시: `/contexts-space/chess-master/co-work/auth` (이 경로를 기억하세요)

3. **Read Existing Context (기존 내용 읽기)**
  - 위에서 결정된 경로 내에 공유 컨텍스트 파일 (`*_CONTEXT.md`)이 존재하는지 확인하세요. (`list_dir` 사용)
  - 파일이 존재한다면, `view_file`을 사용하여 기존 내용을 읽어오세요. (덮어쓰기가 아닌 '상단 추가(Prepend)'를 위함입니다.)

4. **Draft & Merge Content (내용 작성 및 병합)**
  - 파일이 없으면 새로 작성하고, 있다면 최상단에 새로운 세션 로그를 추가하세요.
  - **[Log Rotation]** 세션 기록은 최신순으로 최대 5건까지만 유지하고, 오래된 기록은 삭제하십시오.
  - **[Strict Rule]** 본문 작성 시 코드 스니펫, 파일명, 함수명 등 구현 상세 정보는 절대 포함하지 마십시오. 오직 '기능적 변경 사항'만 기술해야 합니다.
  - Format Template:
    ```markdown
    # Context Handoff - [YYYY-MM-DD HH:mm]
    ## 🎯 Objective
    ...
    ## 🚧 Status & Progress
    ...
    ## 📝 Business Logic Changes
    (파일명 X, 로직 설명 O)
    ...
    ## 👉 Have To Know
    ...
    ---
    (기존 내용...)
    ```

5. **Save to File (파일 저장)**
  - 작성된 전체 내용을 2번 단계에서 결정한 경로에 저장하세요.
  - Target File: `{결정된경로}/{기능명}_CONTEXT.md` (예: `/contexts-space/chess-master/co-work/auth/AUTH_CONTEXT.md`)
  - 도구: `write_to_file` (Overwrite=true)

6. **Write Knowledge (도메인 지식 갱신)**
  - `/contexts-space` 하위에서 `knowledge` 디렉토리를 찾아 `KNOWLEDGE.md` 파일 경로를 파악하세요.
    - (없다면 `/contexts-space/{프로젝트명}/knowledge/` 경로에 생성)
  - **[Scope Limit]** 본인의 담당 영역(FE)에 해당하는 내용(프레임워크 버전, API 스펙 등)이 변경되었을 때만 해당 섹션을 수정하십시오. 다른 영역은 건드리지 마십시오.
  - 포맷 예시:
    ```markdown
    # FE Content
    ## 📝 Tech Stack Info
    ...
    ## 🎯 Domain Logic Rules
    ...
    ```

7. **Update Global Recent Log (최근 작업 위치 기록)**
   - `/contexts-space/chess-master/RECENT_LOG.md` 파일이 없으면 새로 작성하고, 있다면 최상단에 새로운 경로 로그를 기록하세요.
   - 방금 수정한 컨텍스트 파일의 **경로**와 **기능명**을 최상단에 기록하세요.
   - 포맷: `- [YYYY-MM-DD HH:mm] {작업내용} | Path: {파일경로}`

8. **Final Review (완료 보고)**
  - 저장이 완료되면 사용자에게 "컨텍스트 공유 파일이 업데이트되었음"을 알리고, 특히 `Have To Know` 항목을 요약해 주세요.