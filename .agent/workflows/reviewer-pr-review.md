---
description: 작업자가 생성한 Pull Request(PR)를 검토하여 적합성을 심사합니다.
---

# Code Review & Merge Guide (Reviewer Agent)
다음 절차에 따라 PR을 엄격히 심사하십시오.

## 1. Check Review Queue (리뷰 대상 확인)
- `/contexts-space/log/PR_QUEUE.md` 파일을 읽어서 `[Waiting]` 상태인 PR 번호를 확인하십시오.
- 대기 중인 PR이 없다면 작업을 종료하십시오.
- **Target PR:** 확인된 PR 번호 (이하 `{PR_NUMBER}`)

## 2. Analyze Code (코드 분석)
- 특정 PR의 변경 사항(Diff)을 읽어오십시오.
  - 명령어: `gh pr diff {PR_NUMBER}`
- **심사 기준:**
  1. **기능 적합성:** PR 제목/내용과 실제 코드가 일치하는가?
  2. **안전성:** 하드코딩된 비밀번호, SQL 인젝션 등 보안 취약점은 없는가?
  3. **스타일:** 프로젝트 컨벤션(네이밍 등)을 준수했는가?

## 3. Submit Review (심사 결과 제출)
- 분석 결과를 바탕으로 리뷰를 제출하십시오.
  - **통과 시 (Approve):**
    - 명령어: `gh pr review {PR_NUMBER} --approve --body "LGTM! (코드 구조/보안 문제 없음)"`
  - **반려 시 (Request Changes):**
    - 명령어:
    ```bash
    gh pr review {PR_NUMBER} --request-changes --body "다음 사항 수정 요망:\n- [파일명1] {구체적인 지적 1}\n다음 사항 이행 권고:\n- [파일명2] {권고사항 2}"
    ```

## 4. Merge (병합 - 승인된 경우만)
- 리뷰가 승인(Approve)되었다면, 코드를 병합하고 브랜치를 정리하십시오.
  - 명령어: `gh pr merge {PR_NUMBER} --squash --delete-branch`
- Squash Merge를 사용하여 커밋 히스토리를 깔끔하게 유지합니다.
- **[Exception]** 만약 충돌(Conflict)이 발생하여 병합이 실패할 경우, **절대로 스스로 해결하려 하지 마십시오**. 대신, "충돌 발생, 해결 필요"라는 코멘트를 남기고 종료하십시오.

## 5. Update Review Queue (상태 갱신)
- `/contexts-space/log/PR_QUEUE.md` 파일을 열어 해당 PR의 상태를 업데이트하십시오.
  - 병합 완료 시: `[Waiting]` → `[Merged]`
  - 반려 시: `[Waiting]` → `[Changes Requested]`
  - 충돌 시: `[Waiting]` → `[Conflict]`