let mostWinsBtn = document.getElementById("mostWinsBtn");
let mostGrabsBtn = document.getElementById("mostGrabsBtn");
let mostWinsTable = document.getElementById("mostWins");
let mostGrabsTable = document.getElementById("mostGrabs");

function showOneTable(table, btn) {
  mostWinsBtn.style.background = "#aaa";
  mostGrabsBtn.style.background = "#aaa";

  mostWinsTable.style.display = "none";
  mostGrabsTable.style.display = "none";

  table.style.display = "table";
  btn.style.background = "orange";
}

mostWinsBtn.addEventListener("click", () => {
  showOneTable(mostWinsTable, mostWinsBtn);
})

mostGrabsBtn.addEventListener("click", () => {
  showOneTable(mostGrabsTable, mostGrabsBtn);
})