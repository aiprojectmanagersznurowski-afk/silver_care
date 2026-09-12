import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const apiKey = process.env.TRELLO_API;
const token = process.env.TRELLO_TOKEN;
const boardId = '6aa2a30828269c1448177426';
const michalId = '6a1e8bee5edd0ea47730152c';

async function run() {
  const listsRes = await fetch(`https://api.trello.com/1/boards/${boardId}/lists?key=${apiKey}&token=${token}`);
  const lists = await listsRes.json();
  const listMap = Object.fromEntries(lists.map(l => [l.id, l.name]));

  const res = await fetch(`https://api.trello.com/1/boards/${boardId}/cards?key=${apiKey}&token=${token}`);
  const cards = await res.json();
  const michalCards = cards.filter(c => c.idMembers.includes(michalId));
  console.log(`Znaleziono ${michalCards.length} kart przypisanych do Michała:`);
  for (const c of michalCards) {
    console.log(`- [${c.id}] "${c.name}" (Lista: ${listMap[c.idList]} [${c.idList}])`);
  }
}

run().catch(console.error);
