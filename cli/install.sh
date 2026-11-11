#!/bin/sh
# Installe l'outil planning et le minuteur de la carte Vigie (utilisateur courant, sans sudo).
set -e
D=$(cd "$(dirname "$0")" && pwd)
mkdir -p "$HOME/.local/bin" "$HOME/.config/systemd/user"
ln -sf "$D/planning.py" "$HOME/.local/bin/planning"
cp "$D/systemd/planning-card.service" "$D/systemd/planning-card.timer" "$HOME/.config/systemd/user/"
systemctl --user daemon-reload
systemctl --user enable --now planning-card.timer
echo "OK : planning installé, carte mise à jour toutes les 15 min."
