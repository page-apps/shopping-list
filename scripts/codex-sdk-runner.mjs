import { Codex } from "@openai/codex-sdk";

export async function runCodexResearch({ model = "gpt-5.6-luna", prompt, outputSchema, workingDirectory }) {
  const codex = new Codex();
  const thread = codex.startThread({ model, workingDirectory, skipGitRepoCheck: true, sandboxMode: "read-only" });
  const turn = await thread.run(prompt, { outputSchema });
  return JSON.parse(turn.finalResponse);
}
