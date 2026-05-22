
const AI_SIGNATURES = [

"openai",
"gpt-image",
"dall-e",
"midjourney",
"stable diffusion",
"automatic1111",
"comfyui",
"invokeai",
"fooocus",
"adobe firefly",
"firefly",
"flux",
"recraft",
"leonardo",
"playgroundai",
"playground ai",
"canva ai",
"bing image creator",
"ideogram",
"imagen",
"gemini",
"runway",
"luma",
"pika",
"kling",
"novelai"

];

const dropZone = document.getElementById("dropZone");
const fileInput = document.getElementById("fileInput");
const browseBtn = document.getElementById("browseBtn");
const results = document.getElementById("results");
const clearAllBtn = document.getElementById("clearAll");
const downloadAllBtn = document.getElementById("downloadAll");

let cleanFiles = [];

browseBtn.addEventListener("click", e=>{
e.stopPropagation();
fileInput.click();
});

dropZone.addEventListener("click", ()=>fileInput.click());

dropZone.addEventListener("dragover", e=>{
e.preventDefault();
});

dropZone.addEventListener("drop", e=>{
e.preventDefault();
handleFiles(e.dataTransfer.files);
});

fileInput.addEventListener("change", e=>{
handleFiles(e.target.files);
});

clearAllBtn.addEventListener("click", ()=>{
results.innerHTML = "";
cleanFiles = [];
});

downloadAllBtn.addEventListener("click", async()=>{

if(!cleanFiles.length){
alert("No files.");
return;
}

const zip = new JSZip();

cleanFiles.forEach(f=>{
zip.file(f.name, f.blob);
});

const content = await zip.generateAsync({type:"blob"});

const a = document.createElement("a");

a.href = URL.createObjectURL(content);
a.download = "clean-files.zip";

a.click();

});

function handleFiles(files){
[...files].forEach(processFile);
}

async function processFile(file){

const buffer = await file.arrayBuffer();
const bytes = new Uint8Array(buffer);

const imageUrl = URL.createObjectURL(file);

let exif = {};
let pngData = {};
let aiDetections = [];

try{
exif = ExifReader.load(buffer);
}catch(err){}

if(file.type === "image/png"){
pngData = parsePNG(bytes);
}

aiDetections = detectAISignatures(exif, pngData);

const hashes = generateHashes(buffer);

const risk = calculateRisk(aiDetections, pngData);

const rawHeader = getHex(bytes);

const cleanBlob = await stripMetadata(imageUrl);

cleanFiles.push({
name:file.name.replace(/\.[^/.]+$/, "") + "_clean.png",
blob:cleanBlob
});

renderCard({
file,
imageUrl,
exif,
pngData,
aiDetections,
hashes,
risk,
rawHeader,
cleanBlob
});

}

function parsePNG(bytes){

let offset = 8;

const chunks = [];
const textData = [];
const c2pa = [];

while(offset < bytes.length){

const length =
(bytes[offset]<<24) |
(bytes[offset+1]<<16) |
(bytes[offset+2]<<8) |
(bytes[offset+3]);

const type = String.fromCharCode(
bytes[offset+4],
bytes[offset+5],
bytes[offset+6],
bytes[offset+7]
);

chunks.push({
type,
length
});

const dataStart = offset + 8;
const dataEnd = dataStart + length;

const data = bytes.slice(dataStart, dataEnd);

if(type === "tEXt" || type === "iTXt" || type === "zTXt"){

try{

const text = new TextDecoder().decode(data);

textData.push({
type,
text
});

}catch(e){}

}

if(type === "eXIf"){

textData.push({
type:"eXIf",
text:"Embedded EXIF metadata"
});

}

if(type.toLowerCase().includes("c2")){

c2pa.push({
type,
note:"Possible C2PA manifest"
});

}

offset += length + 12;

if(type === "IEND"){
break;
}

}

return {
chunks,
textData,
c2pa
};

}

function detectAISignatures(exif, pngData){

const findings = [];

const combined = JSON.stringify({
exif,
pngData
}).toLowerCase();

AI_SIGNATURES.forEach(sig=>{

if(combined.includes(sig)){
findings.push(sig);
}

});

if(combined.includes("c2pa")){
findings.push("c2pa");
}

if(combined.includes("jumb")){
findings.push("jumbf");
}

if(combined.includes("exif")){
findings.push("exif");
}

return [...new Set(findings)];

}

function calculateRisk(ai, png){

let score = 0;

score += ai.length * 15;

if(png.c2pa?.length){
score += 25;
}

if(score >= 60){
return {
label:"High probability of AI provenance",
class:"risk-high"
};
}

if(score >= 25){
return {
label:"Possible AI provenance",
class:"risk-medium"
};
}

return {
label:"Low AI evidence",
class:"risk-low"
};

}

function generateHashes(buffer){

const wordArray = CryptoJS.lib.WordArray.create(buffer);

return {
md5:CryptoJS.MD5(wordArray).toString(),
sha1:CryptoJS.SHA1(wordArray).toString(),
sha256:CryptoJS.SHA256(wordArray).toString()
};

}

function getHex(bytes){

const limit = Math.min(512, bytes.length);

let hex = [];

for(let i=0;i<limit;i++){

hex.push(
bytes[i].toString(16).padStart(2,"0").toUpperCase()
);

}

return hex.join(" ");

}

function stripMetadata(src){

return new Promise(resolve=>{

const img = new Image();

img.onload = ()=>{

const canvas = document.createElement("canvas");
const ctx = canvas.getContext("2d");

canvas.width = img.width;
canvas.height = img.height;

ctx.drawImage(img,0,0);

canvas.toBlob(blob=>{
resolve(blob);
},"image/png");

};

img.src = src;

});

}

function renderCard(data){

const card = document.createElement("div");

card.className = "card";

card.innerHTML = `

<img src="${data.imageUrl}">

<div class="content">

<h2>${data.file.name}</h2>

<div>
<span class="tag">${data.file.type}</span>
<span class="tag">${(data.file.size/1024/1024).toFixed(2)} MB</span>
<span class="tag ${data.risk.class}">
${data.risk.label}
</span>
</div>

<div class="section">
<h3>AI Signature Detection</h3>

<div>
${
data.aiDetections.length
? data.aiDetections.map(x=>`<span class="tag">${x}</span>`).join("")
: "<span class='tag'>No signatures found</span>"
}
</div>
</div>

<div class="section">
<h3>Hashes</h3>

<div class="box">

MD5:
${data.hashes.md5}

SHA1:
${data.hashes.sha1}

SHA256:
${data.hashes.sha256}

</div>
</div>

<div class="section">
<h3>PNG Chunks</h3>

<div class="box">
${JSON.stringify(data.pngData.chunks || [], null, 2)}
</div>
</div>

<div class="section">
<h3>Text/XMP/C2PA</h3>

<div class="box">
${JSON.stringify({
text:data.pngData.textData || [],
c2pa:data.pngData.c2pa || []
}, null, 2)}
</div>
</div>

<div class="section">
<h3>EXIF Metadata</h3>

<div class="box">
${
Object.keys(data.exif).length
? JSON.stringify(data.exif, null, 2)
: "No standard EXIF metadata found"
}
</div>
</div>

<div class="section">
<h3>Raw Header</h3>

<div class="box">
${data.rawHeader}
</div>
</div>

<a class="download"
href="${URL.createObjectURL(data.cleanBlob)}"
download="${data.file.name}">
Download Clean File
</a>

</div>
`;

results.appendChild(card);

}
