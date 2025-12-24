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
2. **Check for Shared File (공유 파일 확인)**
   - `/contexts-space` 하위의 기능 네이밍 디렉토리를 찾으세요 (`/contexts-space/auth`, `/contexts-space/game` 등).
   - 공유 컨텍스트 파일 (`AUTH_CONTEXT.md` 또는 `GAME_CONTEXT.md` 등의 `*.md`) 파일이 존재하는지 확인하세요.
     - 도구: `list_dir`, `find_by_name` 등을 사용.
   - 파일이 존재한다면, `view_file`을 사용하여 기존 내용을 읽어오세요. 이는 내용을 덮어쓰지 않고 추가(Append)하기 위함입니다.
3. **Draft & Merge Content (내용 작성 및 병합)**
   - 기존 내용이 있다면, **그 위에** 새로운 세션 로그를 추가하는 방식으로 병합하세요. (최신 내용이 상단에 오도록)
   - 파일이 없다면 새로 작성하세요.
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
   - 작성된 전체 내용을 기능 네이밍에 따라 `/contexts-space/**/*.md` 파일에 저장하세요.
     - 경로 예시: `/contexts-space/jwt/JWT_CONTEXT.md`
     - 도구: `write_to_file` (Overwrite=true)
5. **Final Review (완료 보고)**
   - 저장이 완료되면 사용자에게 "컨텍스트 공유 파일이 업데이트되었음"을 알리고, 저장된 `Have To Know` 항목을 간략히 요약해 주세요.