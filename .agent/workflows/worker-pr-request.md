---
description: Pull Request(PR)를 생성하여 검토를 요청합니다.
---

# Git PR Creation Guide (Worker Agent)
작업이 완료되면 다음 절차에 따라 Pull Request(PR)를 생성하여 리뷰어에게 검토를 요청하십시오.

## 1. Branch Safety Check
- 현재 브랜치가 `main`이나 `develop`이 아닌지 확인하십시오.
  - 명령어: `git branch --show-current`
- 만약 현재 브랜치가 `main` 또는 `develop`이라면, **즉시 작업을 멈추고** "작업 브랜치 이외의 브랜치에 위치"라고 알리십시오.

## 2. Commit
- 모든 변경 사항은 사전에 커밋이 되어 있어야 합니다.
- 만약 커밋되지 않은 내역이 존재하면, **즉시 작업을 멈추고** "커밋되지 않은 파일 존재"라고 알리십시오.
  - 명령어: `git status`

## 3. Push
- 변경 사항을 커밋하고 원격 저장소에 푸시하십시오.
  - 명령어: `git push origin {현재브랜치명}`

## 4. Create Pull Request (PR 생성)
- `gh` CLI를 사용하여 PR을 생성합니다.
- 명령어는 한 줄로 실행하되 줄바꿈 기호를 활용하십시오.
  - 명령어:
  ```bash
  gh pr create --title "[Type] 제목" --body "## 작업 내용\n- 상세 내용 1...\n- 상세 내용 2..." --base develop
  ```
- **필수 옵션:**
  - `--title`: 커밋 컨벤션과 동일하게 작성 (예: `feat: 로그인 API 구현`)
  - `--body`: 작업 내용을 요약. 관련 이슈가 있다면 `Closes #123` 포함.
  - `--base`: 타겟 브랜치 (항상 `develop`)

## 5. Update Review Queue (리뷰 대기열 등록)
- PR 생성이 완료되면 `/contexts-space/log/PR_QUEUE.md` 파일 최상단에 다음 정보를 추가하십시오.
  - `- [Waiting] PR #{PR_NUMBER} | Feature: {기능명} | Author: {에이전트명}`
- 등록 후 사용자에게 "PR 생성 및 대기열 등록 완료"를 알리십시오.