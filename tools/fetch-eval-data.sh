#!/usr/bin/env bash
# Download the pinned evaluation data into eval-data/ (ignored by Git) and check it.
# The data is used only to measure accuracy; none of it is shipped.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIR="$ROOT/eval-data"
mkdir -p "$DIR"
cd "$DIR"

GSD=22f73e87f7ddc530bb131a6b7587971a03e1a712
SIMP=4231dfd59866fa5999ad4a6bc1fdecd7985b3b59
MCBPMF=be6564acad6c4d3265c34a2e1a872d80f9db6068

fetch() { [ -f "$1" ] || curl -sfL -o "$1" "$2"; }
fetch Unihan.zip https://www.unicode.org/Public/18.0.0/ucd/Unihan.zip
fetch phrase.occ "https://raw.githubusercontent.com/openvanilla/McBopomofo/$MCBPMF/Source/Data/phrase.occ"
for s in train dev test; do
  fetch "GSD-$s.conllu" "https://raw.githubusercontent.com/UniversalDependencies/UD_Chinese-GSD/$GSD/zh_gsd-ud-$s.conllu"
  fetch "GSDSimp-$s.conllu" "https://raw.githubusercontent.com/UniversalDependencies/UD_Chinese-GSDSimp/$SIMP/zh_gsdsimp-ud-$s.conllu"
done

shasum -a 256 -c <<'SUMS'
4c93ea9c1f636451729a840978f1667a53886af37ba854fdcce109721c63d43e  Unihan.zip
dcd11597090b2bef88fb385bdd567e235ccd916728c84b8d0d3f8069ccfc7b8d  phrase.occ
09374c8361400861a536ae94a1d7710e1cdd72285c32b9764d94d2d956b4ae02  GSD-dev.conllu
ff01a3d01d62b623756396085e78bdaeefb7c2b7935a890dde5b18e92712d54f  GSD-test.conllu
de36e605a4786edb00097165cfc0ee425ab668a2dfc1da7ce4652ba4d2585b1e  GSD-train.conllu
d03f1eeb93b16071bfbbe6c76b971554be87c9a2307b3f3a820dd7c07f73fb63  GSDSimp-dev.conllu
3af8046a6f32477b4d5cf3dd06bbf38682a380fe77aade3f68de97e51ab94900  GSDSimp-test.conllu
956636fe612a1166e8b19e7413fee2e73d68231aca2f0455be2c616b947d629d  GSDSimp-train.conllu
SUMS
unzip -o -q Unihan.zip Unihan_Variants.txt
echo "eval data ready in $DIR"
