const fs = require('fs');
const data = JSON.parse(fs.readFileSync('NEWHR2.json', 'utf8'));

const supabaseNodes = data.nodes.filter(n => n.id.includes('supabase'));
console.log('Supabase Nodes Error Settings:');
supabaseNodes.forEach(node => {
  console.log(`- Node: ${node.data?.label || node.id}`);
  console.log('  onError:', node.onError || 'default (fail)');
  console.log('  continueOnFail:', node.continueOnFail || 'false');
});
