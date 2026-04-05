const prev = [{text: "hello", final: true}];
const isFinal = false;
const text = "world";

const nextState = isFinal
          ? [...prev.filter((t) => t.final), { text, final: true }]
          : [...prev.filter((t) => t.final), { text, final: false }];
console.log(nextState);
