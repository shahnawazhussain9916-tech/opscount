import React, { useEffect, useState } from "react";
import Papa from "papaparse";
import "./App.css";

const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1sqFROsjbUr4Nzk0XWb_BZsyegF1OIXO5iOfGLEmWB3U/export?format=csv&gid=1369150311";

function App() {
  const [employees, setEmployees] = useState([]);
  const [activeList, setActiveList] = useState([]);
  const [badgeInput, setBadgeInput] = useState("");
  const [selectedShift, setSelectedShift] = useState("");
  const [idMap, setIdMap] = useState({});

  // =========================
  // TODAY
  // =========================
  const today = new Date()
    .toLocaleDateString("en-US", {
      weekday: "short",
      timeZone: "Asia/Riyadh",
    })
    .toUpperCase();

  const normalize = (str) =>
    (str || "")
      .toString()
      .trim()
      .toLowerCase();

  const normalizeOff = (str) =>
    (str || "")
      .toString()
      .trim()
      .toUpperCase()
      .slice(0, 3);

  // =========================
  // LOAD SHEET
  // =========================
  useEffect(() => {
    Papa.parse(SHEET_URL, {
      download: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data;

        const empList = [];
        const map = {};

        rows.slice(1).forEach((row) => {
          const [
            psoft,
            badge,
            login,
            name,
            designation,
            division,
            shift,
            off1,
            off2,
          ] = row;

          if (!badge) return;

          const emp = {
            psoft: psoft?.trim(),
            badge: badge?.trim(),
            login: login?.trim(),
            name,
            designation,
            division,
            shift: (shift || "").toUpperCase().trim(),
            off1: normalizeOff(off1),
            off2: normalizeOff(off2),
          };

          empList.push(emp);

          // Multi-ID map
          map[badge?.toLowerCase()] = emp;
          map[login?.toLowerCase()] = emp;
          map[psoft?.toLowerCase()] = emp;
        });

        setEmployees(empList);
        setIdMap(map);
      },
    });
  }, []);

  // =========================
  // START SHIFT
  // =========================
  const startShift = () => {
    const filtered = employees
      .filter((emp) => emp.shift.includes(selectedShift))
      .filter(
        (emp) =>
          emp.off1 !== today &&
          emp.off2 !== today
      )
      .map((emp) => ({
        ...emp,
        status: "PENDING",
        time: "",
      }));

    setActiveList(filtered);
  };

  // =========================
  // CLEAR SHIFT (NEW)
  // =========================
  const clearShift = () => {
    setActiveList([]);
    setBadgeInput("");
  };

  // =========================
  // SCAN
  // =========================
  const markDone = () => {
    const input = normalize(badgeInput);
    if (!input) return;

    const time = new Date().toLocaleString("en-GB", {
      timeZone: "Asia/Riyadh",
    });

    const emp = idMap[input];

    let updated = [...activeList];

    if (emp) {
      const index = updated.findIndex(
        (e) => e.badge === emp.badge
      );

      if (index !== -1) {
        if (updated[index].status === "DONE") {
          setBadgeInput("");
          return;
        }

        updated[index] = {
          ...updated[index],
          status: "DONE",
          time,
        };
      } else {
        updated.push({
          ...emp,
          status: "DONE",
          time,
        });
      }
    } else {
      updated.push({
        psoft: "-",
        badge: input,
        login: "-",
        name: "-",
        designation: "-",
        division: "-",
        shift: "-",
        off1: "-",
        off2: "-",
        status: "NOT IN SHEET",
        time,
        unknown: true,
      });
    }

    setActiveList(updated);
    setBadgeInput("");
  };

  // =========================
  // ENTER KEY
  // =========================
  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      markDone();
    }
  };

  // =========================
  // COUNTS
  // =========================
  const doneCount = activeList.filter((r) => r.status === "DONE").length;
  const pendingCount = activeList.filter((r) => r.status === "PENDING").length;
  const notInSheetCount = activeList.filter((r) => r.status === "NOT IN SHEET").length;

  // =========================
  // SORT
  // =========================
  const sortedList = [...activeList].sort((a, b) => {
    const priority = {
      DONE: 0,
      PENDING: 1,
      "NOT IN SHEET": 2,
    };
    return priority[a.status] - priority[b.status];
  });

  // =========================
  // CSV
  // =========================
  const downloadCSV = () => {
    const csv = Papa.unparse(sortedList);

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `handover_${selectedShift}.csv`;
    link.click();
  };

  // =========================
  // UI
  // =========================
  return (
    <div className="container">
      <h1>OpsCount</h1>

      <h3>Today: {today}</h3>

      <select
        value={selectedShift}
        onChange={(e) => setSelectedShift(e.target.value)}
      >
        <option value="">Select Shift</option>
        <option value="DAY">Day Shift</option>
        <option value="NIGHT">Night Shift</option>
      </select>

      {/* START + CLEAR BUTTONS */}
      <button onClick={startShift}>Start Shift</button>
      <button onClick={clearShift}>Clear</button>

      <hr />

      <textarea
        placeholder="Scan Badge / PSOFT / LOGIN"
        value={badgeInput}
        onChange={(e) => setBadgeInput(e.target.value)}
        onKeyDown={handleKeyDown}
      />

      <button onClick={markDone}>Mark</button>

      <div className="stats">
        <span>✅ Done: {doneCount}</span>
        <span>🟡 Pending: {pendingCount}</span>
        <span>🔴 Not In Sheet: {notInSheetCount}</span>
      </div>

      <button onClick={downloadCSV}>Download CSV</button>

      <h3>Total: {activeList.length}</h3>

      <table>
        <thead>
          <tr>
            <th>Psoft</th>
            <th>Badge</th>
            <th>Login</th>
            <th>Name</th>
            <th>Designation</th>
            <th>Division</th>
            <th>Shift</th>
            <th>Off1</th>
            <th>Off2</th>
            <th>Status</th>
            <th>Time</th>
          </tr>
        </thead>

        <tbody>
          {sortedList.map((emp, i) => (
            <tr
              key={i}
              className={
                emp.status === "DONE"
                  ? "done-row"
                  : emp.status === "NOT IN SHEET"
                  ? "unknown-row"
                  : ""
              }
            >
              <td>{emp.psoft}</td>
              <td>{emp.badge}</td>
              <td>{emp.login}</td>
              <td>{emp.name}</td>
              <td>{emp.designation}</td>
              <td>{emp.division}</td>
              <td>{emp.shift}</td>
              <td>{emp.off1}</td>
              <td>{emp.off2}</td>
              <td>{emp.status}</td>
              <td>{emp.time || "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default App;