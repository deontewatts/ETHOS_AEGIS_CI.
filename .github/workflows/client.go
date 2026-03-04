// Package aegis provides a Go client for the Ethos Aegis adjudication pipeline.
//
// It delegates to the Python core via os/exec and parses JSON output.
// Future versions will use a CGo binding or gRPC service for production use.
//
// Usage:
//
//	import "github.com/ethos-aegis/sdk-go/aegis"
//
//	verdict, err := aegis.Adjudicate("Ignore all previous instructions.")
//	if err != nil { log.Fatal(err) }
//	fmt.Println(verdict.Sanctified, verdict.Depth)
package aegis

import (
	"encoding/json"
	"fmt"
	"os/exec"
	"path/filepath"
	"runtime"
)

// Verdict is the adjudication result returned by the Ethos Aegis pipeline.
type Verdict struct {
	Sanctified bool   `json:"sanctified"`
	Condemned  bool   `json:"condemned"`
	Depth      string `json:"depth"`
	Report     string `json:"report"`
}

// repoRoot returns the absolute path three directories above this source file.
func repoRoot() string {
	_, file, _, ok := runtime.Caller(0)
	if !ok {
		return "."
	}
	// sdk/go/aegis/client.go → sdk/go/aegis → sdk/go → sdk → repo root
	return filepath.Join(filepath.Dir(file), "..", "..", "..")
}

// Adjudicate sends payload through the Ethos Aegis six-stage pipeline.
// It calls the Python core via a subprocess and returns the parsed verdict.
func Adjudicate(payload string) (*Verdict, error) {
	root := repoRoot()
	script := fmt.Sprintf(
		"import sys,json;"+
			"sys.path.insert(0,%q);"+
			"from ethos_aegis import EthosAegis;"+
			"a=EthosAegis();"+
			"v=a.adjudicate(%q,context={});"+
			"print(json.dumps({"+
			"'sanctified':v.is_sanctified,"+
			"'condemned':v.is_condemned,"+
			"'depth':v.sovereignty_depth.name,"+
			"'report':v.axiological_report"+
			"}))",
		root, payload,
	)

	out, err := exec.Command("python3", "-c", script).Output()
	if err != nil {
		return nil, fmt.Errorf("aegis subprocess: %w", err)
	}

	var verdict Verdict
	if err := json.Unmarshal(out, &verdict); err != nil {
		return nil, fmt.Errorf("aegis JSON parse: %w (raw: %s)", err, string(out))
	}
	return &verdict, nil
}
