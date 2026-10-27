import katex from 'katex';

// Test KaTeX with output: 'html'
const res = katex.renderToString('\\frac{y}{4} - 3 = 5', {
  output: 'html',
  throwOnError: false,
});
console.log('Contains mathml:', res.includes('katex-mathml'));
console.log('Result sample:', res.slice(0, 150));
