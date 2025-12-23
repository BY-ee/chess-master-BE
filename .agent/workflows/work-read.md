---
description: 저장되어 있는 공유 컨텍스트 파일(*.md)을 통해 작업해야 할 내용을 분석합니다.
---

1. **Check for Shared File (공유 파일 확인)**
   - `/contexts-space` 하위의 기능 네이밍 디렉토리를 찾으세요 (`/contexts-space/auth`, `/contexts-space/game` 등).
   - 공유 컨텍스트 파일 (`AUTH_CONTEXT.md` 또는 `GAME_CONTEXT.md` 등의 `*.md`) 파일이 존재하는지 확인하세요.
     - 도구: `list_dir`, `find_by_name` 등을 사용.
   - 파일이 존재한다면, `view_file`을 사용하여 기존 내용을 읽어오세요.
   - 파일이 존재하지 않는다면, 이후의 workflow를 수행하지 않습니다.
2. **Analyze Context File (공유 컨텍스트 파일 분석)**
   - 공유 컨텍스트 파일을 분석하세요. 파일 내용의 형식은 다음과 같습니다.
     - **Session Date**: 현재 날짜 및 시간
     - **Objective**: 이번 세션의 주요 목표
     - **Status**: 완료됨 / 진행 중 / 막힘 (이유 포함)
     - **Key Changes**: 주요 변경된 파일 목록 및 핵심 로직 설명
     - **Tech Specs**: 사용된 라이브러리 버전이나 환경 설정 등 유의사항
     - **Have To Know**: 다음 에이전트가 이어받아 수행해야 할 구체적인 작업 목록