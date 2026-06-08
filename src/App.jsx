import React, { useEffect, useState } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import "./App.css";

const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1sqFROsjbUr4Nzk0XWb_BZsyegF1OIXO5iOfGLEmWB3U/export?format=csv&gid=1369150311";

function App() {
  const [employees, setEmployees] = useState([]);
  const [activeList, setActiveList] = useState([]);
  const [badgeInput, setBadgeInput] = useState("");
  const [selectedShift, setSelectedShift] = useState("");
  const [idMap, setIdMap] = useState({});
  const [lastScannedBadge, setLastScannedBadge] = useState("");

  const today = new Date()
    .toLocaleDateString("en-US", {
      weekday: "short",
      timeZone: "Asia/Riyadh",
    })
    .toUpperCase()
    .slice(0, 3);

  const normalize = (str) =>
    (str || "").toString().trim().toLowerCase();

  // =========================
  // LOAD SHEET
  // =========================
  useEffect(() => {
    Papa.parse(SHEET_URL, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data;

        const empList = [];
        const map = {};

        rows.forEach((row) => {
          const emp = {
            psoft: row["Psoft"]?.trim(),
            badge: row["Badge ID"]?.trim(),
            login: row["Login"]?.trim(),
            name: row["Employee Name"]?.trim(),
            designation: row["Designation"]?.trim(),
            shift: (row["Shift"] || "").toUpperCase().trim(),
            off1: (row["off 1"] || "").toUpperCase().trim(),
            off2: (row["off 2"] || "").toUpperCase().trim(),
          };

          if (!emp.badge) return;

          empList.push(emp);

          map[emp.badge?.toLowerCase()] = emp;
          map[emp.login?.toLowerCase()] = emp;
          map[emp.psoft?.toLowerCase()] = emp;
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
      .map((emp) => ({
        ...emp,
        status: "PENDING",
        time: "",
      }));

    setActiveList(filtered);
    setLastScannedBadge("");
  };

  // =========================
  // CLEAR SHIFT
  // =========================
  const clearShift = () => {
    setActiveList([]);
    setBadgeInput("");
    setLastScannedBadge("");
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
      const todayClean = today.trim().toUpperCase();
      const off1 = (emp.off1 || "").trim().toUpperCase();
      const off2 = (emp.off2 || "").trim().toUpperCase();

      const isWeekOff = off1 === todayClean || off2 === todayClean;

      const index = updated.findIndex((e) => e.badge === emp.badge);

      const newStatus = isWeekOff ? "Came on Week Off" : "DONE";

      if (index !== -1) {
        updated[index] = {
          ...updated[index],
          status: newStatus,
          time,
          lastScanned: Date.now(),
        };
      } else {
        updated.push({
          ...emp,
          status: newStatus,
          time,
          lastScanned: Date.now(),
        });
      }

      setLastScannedBadge(emp.badge);
    } else {
      const exists = updated.some(
        (e) =>
          e.status === "Labor Share" &&
          normalize(e.badge) === input
      );

      if (!exists) {
        updated.push({
          psoft: "-",
          badge: input,
          login: "-",
          name: "-",
          designation: "-",
          shift: "-",
          off1: "-",
          off2: "-",
          status: "Labor Share",
          time,
          unknown: true,
        });
      }

      setLastScannedBadge(input);
    }

    setActiveList(updated);
    setBadgeInput("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      markDone();
    }
  };

  // =========================
  // SORT
  // =========================
  const sortedList = [...activeList].sort((a, b) => {
    const priority = {
      DONE: 0,
      PENDING: 1,
      "Came on Week Off": 2,
      "Labor Share": 3,
    };

    if (a.status === "DONE" && b.status === "DONE") {
      return (b.lastScanned || 0) - (a.lastScanned || 0);
    }

    return priority[a.status] - priority[b.status];
  });

  // =========================
  // COUNTS
  // =========================
  const doneCount = activeList.filter((r) => r.status === "DONE").length;
  const pendingCount = activeList.filter((r) => r.status === "PENDING").length;
  const weekOffCount = activeList.filter((r) => r.status === "Came on Week Off").length;
  const notInSheetCount = activeList.filter((r) => r.status === "Labor Share").length;

  // =========================
  // EXCEL EXPORT
  // =========================
  const downloadExcel = () => {
    const exportData = sortedList.map((emp) => ({
      Psoft: emp.psoft,
      Badge: emp.badge,
      Login: emp.login,
      Name: emp.name,
      Designation: emp.designation,
      Shift: emp.shift,
      Off1: emp.off1,
      Off2: emp.off2,
      Status: emp.status,
      Time: emp.time || "-",
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      selectedShift || "Shift"
    );

    XLSX.writeFile(workbook, `handover_${selectedShift || "shift"}.xlsx`);
  };

  // =========================
  // UI
  // =========================
  return (
    <div className="container">
      <h1>OB OpsCount</h1>

      <h3>Today: {today}</h3>

      <select
        value={selectedShift}
        onChange={(e) => setSelectedShift(e.target.value)}
      >
        <option value="">Select Shift</option>
        <option value="DAY">Day Shift</option>
        <option value="NIGHT">Night Shift</option>
      </select>

      {/* SHIFT BUTTONS SIDE BY SIDE */}
      <div className="shift-buttons">
        <button onClick={startShift}>Start Shift</button>
        <button onClick={clearShift}>Clear</button>
      </div>

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
        <span>🟣 Week Off Came: {weekOffCount}</span>
        <span>🔴 Labor Share: {notInSheetCount}</span>
      </div>

      <button onClick={downloadExcel}>Download Excel</button>

      <h3>Total: {activeList.length}</h3>

      <table>
        <thead>
          <tr>
            <th>Psoft</th>
            <th>Badge</th>
            <th>Login</th>
            <th>Name</th>
            <th>Designation</th>
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
                  : emp.status === "Came on Week Off"
                  ? "weekoff-row"
                  : emp.status === "Labor Share"
                  ? "unknown-row"
                  : ""
              }
            >
              <td>{emp.psoft}</td>
              <td>{emp.badge}</td>
              <td>{emp.login}</td>
              <td>{emp.name}</td>
              <td>{emp.designation}</td>
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