// Graphique de l'espace administrateur, dessiné avec Chart.js.
// Les données (issues de MongoDB) sont lues dans l'attribut data-stats du canvas.
const canvas = document.getElementById('graphique');
const stats = JSON.parse(canvas.dataset.stats);

new Chart(canvas, {
  type: 'bar',
  data: {
    labels: stats.map((s) => s.menu_titre),
    datasets: [{ label: 'Nombre de commandes', data: stats.map((s) => s.nombre_commandes), backgroundColor: '#8a3324' }],
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
  },
});
