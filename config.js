body {
  font-family: Arial, sans-serif;
  margin: 0;
  background: #121212;
  color: white;
}

header {
  background: #1f1f1f;
  padding: 15px;
  text-align: center;
}

nav a {
  color: #ffcc00;
  margin: 0 10px;
  text-decoration: none;
  font-weight: bold;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 15px;
  padding: 20px;
}

.card {
  background: #1e1e1e;
  padding: 15px;
  border-radius: 8px;
}

.button {
  display: inline-block;
  background: #ffcc00;
  color: black;
  padding: 10px 15px;
  text-decoration: none;
  border-radius: 6px;
  font-weight: bold;
}

.button.admin {
  background: red;
  color: white;
}
