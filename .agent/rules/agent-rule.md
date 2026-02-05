---
trigger: always_on
---

# 📂 Chess Master BE Specific Instructions
이 파일은 전역 지침(`~/.gemini/GEMINI.md`)을 상속받아, 본 프로젝트에 특화된 기술적 제약을 정의합니다.
## 1. 🛠️ Tech Stack & Context
- **Language:** TypeScript 5.7+
- **Web Framework:** NestJS 11+
- **DB:** PostgreSQL + Prisma ORM 5.22+
- **Realtime:** Socket.io (Gateway)
- **Testing:** Jest
## 2. 🏛️ Architecture Rules
- **Modular Architecture:** NestJS의 모듈 시스템(Module, Controller, Service)을 준수하십시오.
- **DTO:** API 요청/응답 시 `class-validator`와 `class-transformer`를 사용한 DTO 클래스를 정의하십시오.
- **Prisma:** DB 접근은 Prisma Client를 통해 수행하며, 복잡한 쿼리는 raw query보다 Prisma API를 우선 사용합니다.
- **Authentication:** Passport와 JWT 전략을 사용하고, `auth` 모듈에서 관리합니다.
## 3. 📝 Coding Conventions (Overrides)
- **Async/Await:** 비동기 작업 시 Promise 체이닝보다 `async/await` 문법을 선호합니다.
- **Strict Typing:** `any` 타입 사용을 지양하고, 명시적인 인터페이스나 타입을 정의하십시오.
- **Naming:** 파일명은 `kebab-case`(e.g., `game.service.ts`), 클래스명은 `PascalCase`를 사용하십시오.
---
**[Maintenance Reminder]**
라이브러리 버전 업데이트 등의 작업 발생 시, 본 파일(프로젝트 지침)의 'Tech Stack' 섹션을 최신화하십시오.