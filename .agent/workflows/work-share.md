---
description: 현재 작업의 목표, 진행 상황, 기술적 결정 사항 등을 분석하여 공유 컨텍스트 파일(*.md)에 저장합니다.
---

1. **Analyze Session Context (세션 분석)**
   - 해당 컨텍스트의 대화 기록과 최근 수정된 파일들을 분석하여 다음 정보를 추출하세요.
     - **Session Date**: 현재 날짜 및 시간
     - **Objective**: 이번 세션의 주요 목표
     - **Status**: 완료됨 / 진행 중 / 막힘 (이유 포함)
     - **Key Changes**: 주요 변경된 파일 목록 및 핵심 로직 설명
     - **Tech Specs**: 사용된 라이브러리 버전이나 환경 설정 등 유의사항
     - **Have To Know**: 다음 에이전트가 이어받아 수행해야 할 구체적인 작업 목록
2. **Check for Shared File For Co-Work (협업 공유 파일 확인)**
   - `/contexts-space` 하위의 기능 네이밍 디렉토리를 찾으세요 (`/contexts-space/**/co-work/auth`, `/contexts-space/**/co-work/game` 등).
   - 공유 컨텍스트 파일 (`AUTH_CONTEXT.md` 또는 `GAME_CONTEXT.md` 등의 `*_CONTEXT.md`) 파일이 존재하는지 확인하세요.
     - 도구: `list_dir`, `find_by_name` 등을 사용.
   - 파일이 존재한다면, `view_file`을 사용하여 기존 내용을 읽어오세요. 이는 내용을 덮어쓰지 않고 추가(Append)하기 위함입니다.
3. **Draft & Merge Content (내용 작성 및 병합)**
   - 파일이 없다면 새로 작성하세요.
   - 기존 내용이 있다면, **그 위에** 새로운 세션 로그를 추가하는 방식으로 병합하세요. (최신 내용이 상단에 오도록)
   - 세션은 최신순으로 최대 5건까지만 유지해야 합니다. 각 세션은 ---로 구분되어 있습니다.
   - `코드 솔루션, 코드 수정 예시, 특정 파일명 제시` 등 본인의 소스 코드와 상대의 소스 코드는 제안 및 관여하지 않습니다. `Objective, Status, Key Changes` 등 비즈니스 부분을 집중 기술해주세요.
   - 포맷 예시:
     ```markdown
     # Context Handoff - [YYYY-MM-DD HH:mm]
     ## 🎯 Objective
     ...
     ## 🚧 Status & Progress
     ...
     ## 📝 Key Changes & Notes
     ...
     ## 👉 Have To Know
     ...
     ---
     (기존 내용...)
     ```
4. **Save to File (파일 저장)**
   - 작성된 전체 내용을 기능 네이밍에 따라 `/contexts-space/**/co-work/**/*.md` 파일에 저장하세요.
     - 경로 예시: `/contexts-space/**/co-work/jwt/JWT_CONTEXT.md`
     - 도구: `write_to_file` (Overwrite=true)
5. **Write Knowledge (항상 인지해야 할 내용 작성)**
   - `/contexts-space` 하위의 인지 내용 파일을 찾으세요 (`/contexts-space/**/knowledge/KNOWLEDGE.md).
   - 프로젝트에 연관된 모두가 항상 인지하고 있어야 할 내용이 추가 및 변경되었다면, 해당 내용을 추가 및 변경하세요 (프레임워크/라이브러리 버전, API 응답 형식 등). 특정 기능에 종속된 내용은 추가하지 않습니다.
   - 본인의 영역이 아닌 다른 영역에는 내용을 추가 및 변경하지 않습니다 (예: FE를 담당하는 경우 FE Content 영역에만 관여할 것).
   - 포맷 예시:
     ```markdown
     # FE Content
     ## 📝 Framework & Library Version
     ...
     ## 🎯 Data Response Pattern
     ...
     ## 🚧 Error Response Pattern
     ...
     ```
6. **Final Review (완료 보고)**
   - 저장이 완료되면 사용자에게 "컨텍스트 공유 파일이 업데이트되었음"을 알리고, 협업 공유 파일에 추가된 `Have To Know` 항목을 간략히 요약해 주세요.