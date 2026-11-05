import { main } from "./main";

const code = await main(process.argv.slice(2), {
  out: (text) => process.stdout.write(text),
  err: (text) => process.stderr.write(text),
  cwd: process.cwd(),
  today: () => new Date().toISOString().slice(0, 10),
});
process.exit(code);
