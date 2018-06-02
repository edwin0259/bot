let mostPlayedBtn = document.getElementById("mostPlayedBtn");
let hotPlaysBtn = document.getElementById("hotPlaysBtn");
let mostGrabbedBtn = document.getElementById("mostGrabbedBtn");
let mostPlayedTable = document.getElementById("mostPlayed");
let mostGrabbedTable = document.getElementById("mostGrabbed");
let hotPlaysTable = document.getElementById("hotPlays");

function showOneTable(table, btn) {
  mostPlayedBtn.style.background = "#aaa";
  hotPlaysBtn.style.background = "#aaa";
  mostGrabbedBtn.style.background = "#aaa";
  mostPlayedTable.style.display = "none";
  mostGrabbedTable.style.display = "none";
  hotPlaysTable.style.display = "none";

  table.style.display = "table";
  btn.style.background = "orange";
}

mostPlayedBtn.addEventListener("click", () => {
  showOneTable(mostPlayedTable, mostPlayedBtn);
})

hotPlaysBtn.addEventListener("click", () => {
  showOneTable(hotPlaysTable, hotPlaysBtn);
})

mostGrabbedBtn.addEventListener("click", () => {
  showOneTable(mostGrabbedTable, mostGrabbedBtn);
})