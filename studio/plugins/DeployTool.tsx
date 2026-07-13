import { useState } from "react";
import { Box, Button, Card, Heading, Spinner, Stack, Text } from "@sanity/ui";
import { RocketIcon } from "@sanity/icons";

type Status = "idle" | "deploying" | "success" | "error";

// The Studio is hosted separately, so this must be absolute. artofmany.com still
// points at the old Cargo site — switch this over once the domain is attached to
// the Worker (and add the new origin to ALLOWED_ORIGINS in src/pages/api/deploy.ts).
const SITE_ORIGIN = "https://artofmany.dvaivananadivane.workers.dev";

export function DeployTool() {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleDeploy() {
    setStatus("deploying");
    setErrorMsg("");

    try {
      const res = await fetch(`${SITE_ORIGIN}/api/deploy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!json.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setStatus("success");
      setTimeout(() => setStatus("idle"), 5000);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setStatus("error");
    }
  }

  return (
    <Box padding={4}>
      <Card
        padding={5}
        radius={3}
        shadow={1}
        tone="default"
        style={{ maxWidth: 480 }}
      >
        <Stack gap={5}>
          <Heading size={2}>Deploy site</Heading>

          <Text muted size={1}>
            Triggers a rebuild and deployment of{" "}
            <strong>{new URL(SITE_ORIGIN).hostname}</strong> via Cloudflare
            Workers.
            <br />
            The build usually takes a few minutes.
          </Text>

          {status === "idle" && (
            <Button
              tone="primary"
              icon={RocketIcon}
              text="Deploy now"
              onClick={handleDeploy}
            />
          )}

          {status === "deploying" && (
            <Button tone="primary" icon={Spinner} text="Deploying…" disabled />
          )}

          {status === "success" && (
            <Card tone="positive" padding={3} radius={2}>
              <Text size={1}>
                Deploy triggered successfully. Check the Cloudflare dashboard for
                progress.
              </Text>
            </Card>
          )}

          {status === "error" && (
            <Stack gap={3}>
              <Card tone="critical" padding={3} radius={2}>
                <Text size={1}>Deploy failed: {errorMsg || "Unknown error"}</Text>
              </Card>
              <Button tone="default" text="Try again" onClick={handleDeploy} />
            </Stack>
          )}
        </Stack>
      </Card>
    </Box>
  );
}
