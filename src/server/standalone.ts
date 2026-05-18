import path from 'node:path';
import { startServer } from './server';

const projectRoot = path.resolve(__dirname, '..', '..');
const port = Number(process.env.KRAKEN_BOOK_PORT ?? 5000);

startServer({
  port,
  projectRoot,
  appRoot: path.join(projectRoot, 'app'),
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
