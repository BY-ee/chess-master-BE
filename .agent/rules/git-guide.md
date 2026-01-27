---
trigger: always_on
---

# **개발이 시작/진행/완료될 때마다, 이하의 git branch convention과 git commit convention을 따라 항상 브랜치를 생성하고 커밋을 만들어야 합니다.**
# Git-flow 방식을 활용하며, 커밋 방식은 `/git-flow-commit` 워크플로우를 따릅니다.
# 줄바꿈은 `\n`이 아닌 enter 입력 등으로 커밋 메시지에 "\n" 문구가 추가되지 않고 실제 줄바꿈되도록 합니다.

## git branch convention은 Git-flow 전략을 따르도록 합니다.
1. main: 운영 환경과 연동되는 브랜치 (**직접 commit & push 금지**, develop 브랜치만 활용하도록 함)
2. develop: 개발 환경과 연동되는 브랜치 (**직접 commit & push 금지**)
3. feat/*: 각 기능을 개발할 때 사용되는 브랜치
4. fix/*: 버그를 수정할 때 사용되는 브랜치
5. hotfix/*: 긴급 수정이 필요할 때 사용되는 브랜치 (긴급한 수정건이 아닌 경우 fix 브랜치를 주로 활용하도록 함)

## git commit convention은 해당 convention을 따라 메시지를 작성하도록 합니다.
<Header> (<Type>: <Subject>)
<Content>
<Footer>

1. Type: 해당 커밋의 작업 구분 (Header의 접두사)
- feat → 새로운 기능을 추가한 경우 사용
- add → 코드, 테스트, 예제, 문서 등을 추가한 경우 사용
- fix → 버그를 수정한 경우 사용
- update → 프로젝트의 버전이 업데이트된 경우 사용
- refactor → 코드/구조가 리팩토링된 경우 사용
- test → 테스트 코드가 수정된 경우 사용
- docs → 문서가 수정된 경우 사용
- chore → 이외의 사소한 수정건
- revert → 커밋 혹은 변경사항을 되돌린 경우 사용

ex)
feat: 어떤 좋은 기능에 대한 개발

2. Content: 해당 커밋을 상세하게 설명하는 본문 (Type과 Subject로 충분히 설명 가능한 경우 생략 가능)
ex)
- 구체적으로 이런 기능을 개발
- 해당 기능에 대한 개선 및 테스트 완료

3. Footer: 어떤 이슈에서 온 커밋인지, 이슈 발생인지, 혹은 해결인지 등의 참조 정보
ex)
Resolves: #1234