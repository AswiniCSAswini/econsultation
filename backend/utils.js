import natural from 'natural';
const tokenizer = new natural.WordTokenizer();
import fs from 'fs';


export function computeKeywords(comments, topK=50) {
const stopwords = new Set([
'the','and','for','that','this','with','from','are','was','have','has','not','will','would','can','should','draft','section'
]);
const counter = new Map();
for (const c of comments) {
const text = (c || '').toLowerCase();
const tokens = tokenizer.tokenize(text);
for (const t of tokens) {
if (t.length < 3) continue;
if (stopwords.has(t)) continue;
const cur = counter.get(t) || 0;
counter.set(t, cur+1);
}
}
const arr = Array.from(counter.entries()).sort((a,b)=>b[1]-a[1]).slice(0,topK).map(([w,c])=>({word:w,count:c}));
return arr;
}


export function sampleRepresentativeComments(rows, counts) {
// simple sampling: pick 4 negative (if exist), 4 positive, 4 neutral
const negatives = rows.filter(r=>r.sentiment==='Negative');
const positives = rows.filter(r=>r.sentiment==='Positive');
const neutrals = rows.filter(r=>r.sentiment==='Neutral');
const sample = [];
sample.push(...negatives.slice(0,4));
sample.push(...positives.slice(0,4));
sample.push(...neutrals.slice(0,4));
// if not enough, fill with random
let i=0;
while (sample.length < 12 && i < rows.length) { sample.push(rows[i]); i++; }
return sample.slice(0,12).map(r=>r.comment_text.substring(0,240));
}