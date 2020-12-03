// TODO: test only, delete.

const { post } = require('request-zero');

async function sleep(to) {
  return new Promise((resolve) => setTimeout(resolve, to * 1000));
}

async function main() {
  while (true) {
    try {
      await post('http://localhost:8084/refresh', Buffer.from('test'));
    } catch (e) {
      console.log(`Error`, e);
    }
    await sleep(2 * 60);
  }
}

(async () => {
  await main();
})();
