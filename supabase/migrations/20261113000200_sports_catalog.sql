-- Catálogo deportivo inicial del piloto (España → EE. UU.).
-- Es configuración, no datos de usuarios: se puede ampliar sin tocar el código.

insert into public.sports (id, name_es, name_en) values
  ('basketball', 'Baloncesto', 'Basketball'),
  ('soccer', 'Fútbol', 'Soccer'),
  ('tennis', 'Tenis', 'Tennis'),
  ('athletics', 'Atletismo', 'Track & Field')
on conflict (id) do nothing;

insert into public.sport_positions (sport_id, code, name_es, name_en) values
  ('basketball', 'PG', 'Base', 'Point Guard'),
  ('basketball', 'SG', 'Escolta', 'Shooting Guard'),
  ('basketball', 'SF', 'Alero', 'Small Forward'),
  ('basketball', 'PF', 'Ala-pívot', 'Power Forward'),
  ('basketball', 'C', 'Pívot', 'Center'),
  ('soccer', 'GK', 'Portero/a', 'Goalkeeper'),
  ('soccer', 'CB', 'Central', 'Center Back'),
  ('soccer', 'FB', 'Lateral', 'Full Back'),
  ('soccer', 'DM', 'Mediocentro defensivo', 'Defensive Midfielder'),
  ('soccer', 'CM', 'Mediocentro', 'Central Midfielder'),
  ('soccer', 'AM', 'Mediapunta', 'Attacking Midfielder'),
  ('soccer', 'W', 'Extremo', 'Winger'),
  ('soccer', 'ST', 'Delantero/a', 'Striker'),
  ('tennis', 'SGL', 'Individual', 'Singles'),
  ('tennis', 'DBL', 'Dobles', 'Doubles'),
  ('athletics', 'SPR', 'Velocidad', 'Sprints'),
  ('athletics', 'MID', 'Medio fondo', 'Middle Distance'),
  ('athletics', 'DST', 'Fondo', 'Distance'),
  ('athletics', 'HUR', 'Vallas', 'Hurdles'),
  ('athletics', 'JMP', 'Saltos', 'Jumps'),
  ('athletics', 'THR', 'Lanzamientos', 'Throws'),
  ('athletics', 'CMB', 'Pruebas combinadas', 'Combined Events')
on conflict (sport_id, code) do nothing;

insert into public.sport_stat_definitions (sport_id, code, label_es, label_en, unit, higher_is_better, sort_order) values
  ('basketball', 'ppg', 'Puntos por partido', 'Points per game', 'pts', true, 1),
  ('basketball', 'rpg', 'Rebotes por partido', 'Rebounds per game', 'reb', true, 2),
  ('basketball', 'apg', 'Asistencias por partido', 'Assists per game', 'ast', true, 3),
  ('basketball', 'fg_pct', '% tiro de campo', 'Field goal %', '%', true, 4),
  ('basketball', 'three_pct', '% triples', '3-point %', '%', true, 5),
  ('basketball', 'mpg', 'Minutos por partido', 'Minutes per game', 'min', true, 6),
  ('soccer', 'matches', 'Partidos', 'Matches', null, true, 1),
  ('soccer', 'minutes', 'Minutos', 'Minutes', 'min', true, 2),
  ('soccer', 'goals', 'Goles', 'Goals', null, true, 3),
  ('soccer', 'assists', 'Asistencias', 'Assists', null, true, 4),
  ('soccer', 'clean_sheets', 'Porterías a cero', 'Clean sheets', null, true, 5),
  ('tennis', 'utr', 'UTR', 'UTR rating', null, true, 1),
  ('tennis', 'national_ranking', 'Ranking nacional', 'National ranking', '#', false, 2),
  ('tennis', 'wins', 'Victorias (temporada)', 'Wins (season)', null, true, 3),
  ('tennis', 'losses', 'Derrotas (temporada)', 'Losses (season)', null, false, 4),
  ('athletics', 'pb_100m', 'Marca personal 100 m', '100m personal best', 's', false, 1),
  ('athletics', 'pb_400m', 'Marca personal 400 m', '400m personal best', 's', false, 2),
  ('athletics', 'pb_800m', 'Marca personal 800 m', '800m personal best', 's', false, 3),
  ('athletics', 'pb_1500m', 'Marca personal 1500 m', '1500m personal best', 's', false, 4),
  ('athletics', 'pb_long_jump', 'Marca personal longitud', 'Long jump personal best', 'm', true, 5),
  ('athletics', 'pb_high_jump', 'Marca personal altura', 'High jump personal best', 'm', true, 6),
  ('athletics', 'pb_shot_put', 'Marca personal peso', 'Shot put personal best', 'm', true, 7)
on conflict (sport_id, code) do nothing;
