import rules from "../../docs/game-rules.json";
import cards from "../../assets/catalogs/cards.json";
import backgrounds from "../../assets/catalogs/backgrounds.json";
import members from "../../assets/catalogs/members.json";
import curriculum from "../../questions/curriculum.json";
import questions from "../../questions/questions.json";
import examples from "../../questions/examples.json";
export { rules, cards, backgrounds, members, curriculum, questions, examples };
export const cardMap = Object.fromEntries(cards.map((c) => [c.id, c]));
export const questionMap: Record<string, any> = Object.fromEntries(
  questions.map((q) => [q.id, q]),
);
export const exampleMap: Record<string, any> = Object.fromEntries(
  examples.map((e) => [e.id, e]),
);
export const asset = (path: string) =>
  new URL("../" + path, document.baseURI).href;
export const publicAsset = (path: string) =>
  new URL(path, document.baseURI).href;
