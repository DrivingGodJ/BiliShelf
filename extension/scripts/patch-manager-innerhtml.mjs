import fs from "node:fs";
import path from "node:path";

const managerAssetsDir = path.resolve(
  process.cwd(),
  "../extension/public/manager/assets"
);

if (!fs.existsSync(managerAssetsDir)) {
  throw new Error(`Manager assets dir not found: ${managerAssetsDir}`);
}

const targets = fs
  .readdirSync(managerAssetsDir)
  .filter((file) => file.endsWith(".js"));

if (targets.length === 0) {
  throw new Error("No manager bundle found to patch.");
}

const functionPattern =
  /insertStaticContent\([^)]*\)\{[\s\S]*?\}\},([A-Za-z_$][\w$]*)="/;

const replacement =
  "insertStaticContent(e,t,n,s,r,o){" +
  "const i=n?n.previousSibling:t.lastChild;" +
  "if(r&&(r===o||r.nextSibling))" +
  "for(;t.insertBefore(r.cloneNode(!0),n),!(r===o||!(r=r.nextSibling)););" +
  "else{" +
  "const p=new DOMParser();" +
  "const a=s===\"svg\"?p.parseFromString(`<svg xmlns=\\\"http://www.w3.org/2000/svg\\\">${e}</svg>`,`image/svg+xml`)" +
  ":s===\"mathml\"?p.parseFromString(`<math xmlns=\\\"http://www.w3.org/1998/Math/MathML\\\">${e}</math>`,`application/xml`)" +
  ":p.parseFromString(e,`text/html`);" +
  "const l=document.createDocumentFragment();" +
  "const d=s===\"svg\"||s===\"mathml\"?a.documentElement:a.body;" +
  "if(d)for(const m of Array.from(d.childNodes))l.appendChild(m);" +
  "t.insertBefore(l,n)" +
  "}" +
  "return[i?i.nextSibling:t.firstChild,n?n.previousSibling:t.lastChild]" +
  "}}";

const patchedTargets = [];
for (const file of targets) {
  const fullPath = path.join(managerAssetsDir, file);
  const code = fs.readFileSync(fullPath, "utf8");
  const match = code.match(functionPattern);

  if (!match) continue;

  const patched = code.replace(
    functionPattern,
    `${replacement},${match[1]}="`,
  );
  fs.writeFileSync(fullPath, patched);
  patchedTargets.push(file);
}

if (patchedTargets.length === 0) {
  throw new Error("insertStaticContent not found in any manager JavaScript bundle.");
}

console.info("[patch-manager-innerhtml] Patched manager bundle(s):", patchedTargets);
