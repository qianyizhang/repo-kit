---
description: Fixture mini-glossary for glossary-drill hermetic tests.
scope: test fixture
status: stable
last_update: 2026-07-10
---

# Fixture Glossary

## Strategic Design

| Term | Full form | 中文 | 中文解释 | _Avoid_ |
| :--- | :--- | :--- | :--- | :--- |
| Bounded Context | Bounded Context | 限界上下文 | 模型与术语在此边界内含义唯一。 | context, module boundary |
| Ubiquitous Language | Ubiquitous Language | 通用语言 | 领域、文档与代码共用的规范词表。 | jargon, slang |

## Bounded Vocabulary Clarifications

Same word, different sides of the review gate.

| Term | Owning BC | 中文 | Meaning | 中文释义 | ≠ (do not confuse) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Candidate | extraction | 抽取候选 | AI draft claim with citations; untrusted until review. | 带出处的 AI 草稿主张，审核前不可信。 | ProtocolAtom, CareGap |
| ProtocolAtom | protocols | 协议原子 | Approved immutable clinical knowledge atom. | 已批准、不可变的临床知识原子。 | Candidate, CandidateArtifact |

## Ops Terms

| Term | Full form | 中文 | 中文解释 |
| :--- | :--- | :--- | :--- |
| Shared Kernel | Shared Kernel | 共享内核 | 多上下文共享的稳定子模块。 |
| Interface Layer | Interface Layer | 接口层 | 将 HTTP/CLI/UI 翻译为领域调用的薄层。 |
