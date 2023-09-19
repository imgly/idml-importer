#!/bin/bash
set -euo pipefail
# check if argument is given
if [ $# -eq 0 ]; then
    echo "No arguments supplied. Please provide a path to the folder containing the PDFs and IDMLs, like e.g test/examples."
    exit 1
fi
echo "Preparing files in $1"
echo "Converting PDFs to PNGs"
find $1 -name "*.pdf" | xargs -I {} convert -density 300 {} -background white -alpha remove {}.png && find $1 -name "*.pdf.png" | while read f; do mv "$f" "${f%.pdf.png}-0.png"; done
echo "Unzipping IDMLs"
find $1 -name \"*.idml\" | xargs -I {} unzip -o {} -d {}-idml
