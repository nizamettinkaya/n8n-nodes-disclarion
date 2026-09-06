# n8n-nodes-disclarion

This is an n8n community node. It lets you use [Disclarion](https://disclarion.com) in your n8n workflows.

Disclarion logs AI-generated interactions and gives you back disclosure metadata so you can meet [EU AI Act Article 50](https://artificialintelligenceact.eu/article/50/) transparency obligations — labeling AI-generated content and disclosing that a user is talking to an AI system.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/sustainable-use-license/) workflow automation platform.

[Installation](#installation)
[Operations](#operations)
[Credentials](#credentials)
[Compatibility](#compatibility)
[Usage](#usage)
[Resources](#resources)
[Version history](#version-history)

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation, and search for `n8n-nodes-disclarion`.

## Operations

* **Track Interaction** — logs one AI response with Disclarion. Returns the stored log entry plus `is_first_message`, which tells you whether this is the first message in the session (useful for deciding whether to show an AI-disclosure notice to the end user).

## Credentials

You need a Disclarion account and an API key:

1. Sign up at [app.disclarion.com](https://app.disclarion.com).
2. Go to **Project Settings → API Keys** and create a key (`dcl_live_...` or `dcl_test_...`).
3. In n8n, create a **Disclarion API** credential and paste the key in. Leave **Base URL** as `https://api.disclarion.com` unless you're on a self-hosted or staging backend.
4. Use the credential's **Test** button to verify the key — it calls `GET /v1/me`, which only reads account info and never writes a log entry.

## Compatibility

Tested against n8n 1.x with `n8nNodesApiVersion: 1`. No known version incompatibilities.

## Usage

Add the **Disclarion** node anywhere in your workflow after you've called an LLM (OpenAI, Anthropic, Gemini, or any other provider). Fill in:

* **Session ID** — a stable identifier for the end-user conversation (e.g. a chat session ID), used to group log entries and detect the first message in a session.
* **Provider** and **Model Name** — which model produced the response.
* Optionally, under **Additional Fields**: the provider's own response ID, and any extra JSON metadata you want stored alongside the log.

The node can also be used directly as a tool by n8n's AI Agent node, so an agent can log its own reply as it generates it.

## Resources

* [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
* [Disclarion documentation](https://disclarion.com/docs)
* [Disclarion Python SDK](https://pypi.org/project/disclarion/) (for logging directly from application code instead of a workflow)

## Version history

* **0.1.0** — Initial release: Track Interaction operation, API key credential with key verification.
