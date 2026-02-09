---
description: 저장되어 있는 공유 컨텍스트 파일(*.md)을 통해 작업해야 할 내용을 분석합니다.
---

## 1. Identify Recent Context (최근 작업 위치 파악)
- `/contexts-space/chess-master/log/RECENT_LOG.md` 파일을 읽으세요.
- 최상단에 기록된 경로(Path)를 확인하여, 사용자가 별도의 지시를 하지 않았다면 **해당 경로의 컨텍스트 파일**을 자동으로 로드 대상으로 선정하세요.
- (만약 로그 파일이 없다면 기존의 2번 '폴더 탐색' 방식으로 폴백합니다.)

## 2. Check for Shared File (공유 파일 확인)
- `list_dir` 도구를 사용하여 `/contexts-space` 하위에 존재하는 모든 디렉토리 목록을 확보하세요.
- 확보된 목록 중에서 현재 작업 중인 기능(예: 로그인 → `auth`, 결제 → `payment` 등)과 가장 유사한 이름의 디렉토리를 선택하세요 (`/contexts-space/chess-master/co-work/{유사한폴더명}`).
- 공유 컨텍스트 파일 (`AUTH_CONTEXT.md` 또는 `GAME_CONTEXT.md` 등의 `*.md`) 파일이 존재하는지 확인하세요.
  - 도구: `list_dir`, `find_by_name` 등을 사용.
    1. 파일이 존재한다면, `view_file`을 사용하여 기존 내용을 읽어오세요.
    2. 파일이 존재하지 않는다면, 3번 workflow (공유 컨텍스트 파일 분석)를 수행하지 않습니다.

## 3. Analyze Context File (공유 컨텍스트 파일 분석)
- 공유 컨텍스트 파일을 분석하세요. 파일 내용의 형식은 다음과 같습니다.
  - **Session Date**: 현재 날짜 및 시간
  - **Objective**: 이번 세션의 주요 목표
  - **Status**: 완료됨 / 진행 중 / 막힘 (이유 포함)
  - **Business Logic Changes**: 이전 세션에서 구현된 핵심 비즈니스 로직의 변경 사항 (파일명/코드는 포함되지 않음)
  - **Tech Specs**: 사용된 라이브러리 버전이나 환경 설정 등 유의사항
  - **Have To Know**: 다음 에이전트가 이어받아 수행해야 할 구체적인 작업 목록
- **(Action)** 분석이 끝나면, 위 내용(특히 `Have To Know`와 `Tech Specs`)을 바탕으로 **현재 세션의 작업 계획을 수립하거나 수정해야 합니다.** 만약 이전 에이전트가 남긴 '막힘(Status: Blocked)' 이슈가 있다면, 이를 우선적으로 해결하는 것을 목표로 삼으세요.
- **(Validate Check)**: 파일의 내용을 분석할 때 다음 사항을 점검하십시오.
  1. `Session Date`가 최근(예: 1주일 이내)인지 확인하세요. 너무 오래되었다면 정보의 신뢰도가 낮을 수 있음을 인지하고, 필요 시 사용자에게 재확인을 요청하세요.
  2. 필수 필드(`Status`, `Have To Know`)가 누락되어 있다면, "컨텍스트 정보 부족"으로 간주하고 보수적으로 행동(사전 질문 등)하십시오.

## 4. Read Knowledge (장기 기억 확인)
- `/contexts-space/chess-master/knowledge/KNOWLEDGE.md` 파일을 찾으세요.
  1. 파일이 존재한다면, `view_file`을 사용하여 내용을 읽어 프로젝트의 핵심 도메인 규칙을 인지하세요.
  2. 파일이 존재하지 않는다면, 이 단계를 건너뜁니다.