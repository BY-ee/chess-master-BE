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
- PR 본문의 줄바꿈과 포맷을 유지하기 위해, 텍스트를 직접 입력하지 말고 **파일 기반 방식**을 사용하십시오.
  1. 본문 작성: 프로젝트 루트에 `PR_BODY_{기능명}.md`라는 임시 파일을 생성하고, 마크다운 형식으로 작업 내용을 작성하십시오.
    - `write_to_file` 도구 활용
    - 작업 내용 예시:
    ```markdown
    ## 작업 내용
    - 상세 내용 1...
    - 상세 내용 2...
    ```
    - **필수 옵션:**
      - `--title`: 커밋 컨벤션과 동일하게 작성 (예: `feat: 로그인 API 구현`)
      - `--body`: 작업 내용을 요약. 관련 이슈가 있다면 `Closes #123` 포함.
      - `--base`: 타겟 브랜치 (항상 `develop`)
  2. PR 생성: `PR_BODY_{기능명}.md` 임시 파일의 내용으로 PR을 생성하십시오.
    - `gh` CLI의 `--body-file` 옵션을 사용
    - 명령어: `gh pr create --title "[Type] 제목" --body-file "PR_BODY_{기능명}.md" --base develop`
  3. 청소: 생성이 완료되면 `PR_BODY_{기능명}.md` 파일을 삭제하십시오.
    - 명령어 : `Remove-Item "PR_BODY_{기능명}.md"`

## 5. Update Review Queue (리뷰 대기열 등록)
- PR 생성이 완료되면 `/contexts-space/chess-master/log/PR_QUEUE.md` 파일 최상단에 다음 정보를 추가하십시오.
  - `- [Waiting] PR #{PR_NUMBER} | Feature: {기능명} | Author: {에이전트명}`
- 등록 후 사용자에게 "PR 생성 및 대기열 등록 완료"를 알리십시오.