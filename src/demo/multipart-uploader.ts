// TODO(hw-26): remove after homework
import { readFile } from 'node:fs/promises';

interface PartsInterface {
  partSize: number;
  uploadedPartCount: number;
  parts: { partNumber: number; url: string }[];
}

async function main(): Promise<void> {
  const [api, token, mediaId, file, crashAfter] = process.argv.slice(2);
  const bytes = await readFile(file);
  const response = await fetch(`${api}/media/${mediaId}/parts`, { headers: { authorization: `Bearer ${token}` } });
  const plan = (await response.json()) as PartsInterface;
  console.log(`# pid ${process.pid}: server already has ${plan.uploadedPartCount} parts, signed [${plan.parts.map((part) => part.partNumber)}]`);
  let sent = 0;

  for (const { partNumber, url } of plan.parts) {
    const chunk = bytes.subarray((partNumber - 1) * plan.partSize, partNumber * plan.partSize);
    const put = await fetch(url, { method: 'PUT', body: chunk });

    if (!put.ok) {
      throw new Error(`part ${partNumber}: ${put.status}`);
    }

    sent++;

    if (crashAfter && sent === Number(crashAfter)) {
      console.log(`# pid ${process.pid}: crash after ${sent} parts`);
      process.exit(137);
    }
  }

  console.log(`sent=${sent}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
