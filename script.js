
/*
LOSSLESS METADATA STRIPPING PATCH
Replace ONLY the stripMetadata() function in script.js
with this version.

This removes metadata WITHOUT canvas recompression
for PNG/JPG/WEBP whenever possible.
*/

async function stripMetadataLossless(file){

const buffer = await file.arrayBuffer();
const bytes = new Uint8Array(buffer);

if(file.type === "image/png"){
return stripPNGMetadata(bytes);
}

if(file.type === "image/jpeg"){
return stripJPEGMetadata(bytes);
}

return new Blob([bytes], {type:file.type});

}

function stripPNGMetadata(bytes){

const chunksToRemove = [
"eXIf",
"iTXt",
"tEXt",
"zTXt",
"c2pa",
"jumb",
"jumd"
];

const signature = bytes.slice(0,8);

let offset = 8;

let output = [];

output.push(signature);

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

const totalLength = length + 12;

const chunk = bytes.slice(offset, offset + totalLength);

if(!chunksToRemove.includes(type)){
output.push(chunk);
}

offset += totalLength;

if(type === "IEND"){
break;
}

}

const merged = concatArrays(output);

return new Blob([merged], {type:"image/png"});

}

function stripJPEGMetadata(bytes){

let output = [];

let i = 0;

output.push(bytes[0]);
output.push(bytes[1]);

i = 2;

while(i < bytes.length){

if(bytes[i] !== 0xFF){
break;
}

const marker = bytes[i+1];

if(marker === 0xDA){
output.push(...bytes.slice(i));
break;
}

const length = (bytes[i+2] << 8) + bytes[i+3];

const removeMarkers = [
0xE1,
0xE2,
0xED
];

if(!removeMarkers.includes(marker)){
output.push(...bytes.slice(i, i + length + 2));
}

i += length + 2;

}

return new Blob([new Uint8Array(output)], {type:"image/jpeg"});

}

function concatArrays(arrays){

let total = 0;

arrays.forEach(a=>{
total += a.length;
});

const merged = new Uint8Array(total);

let offset = 0;

arrays.forEach(a=>{
merged.set(a, offset);
offset += a.length;
});

return merged;

}
