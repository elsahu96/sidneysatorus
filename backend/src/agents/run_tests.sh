#!/bin/bash
# Quick script to run Analyzer agent unit tests

echo "Running Analyzer Agent Unit Tests..."
echo "===================================="
echo ""

cd "$(dirname "$0")/../.." || exit 1

pytest src/agents/analyzer/test_analyzer.py -v --tb=short

echo ""
echo "===================================="
echo "Tests completed!"
