-- GAMVORAQ · 012 · Portadas para más juegos.
-- 1) Número de Steam de juegos que sí están en Steam y no lo tenían (su portada oficial aparece al instante).
-- 2) Permite guardar portadas de RAWG (media.rawg.io) para juegos que no están en Steam
--    (Fortnite, Valorant, Minecraft, Nintendo, móviles…). Se buscan solas si configuras RAWG_API_KEY.
-- Se puede ejecutar varias veces.
BEGIN;

UPDATE public.games g SET steam_appid = v.appid
FROM (VALUES
  ('Battlefield 6', 2807960), ('Call of Duty: Black Ops 6', 2933620), ('Call of Duty: Warzone', 1962663),
  ('Civilization VII', 1295660), ('Divinity: Original Sin 2', 435150), ('Dragon Ball: Sparking! ZERO', 1790600),
  ('EA Sports FC 25', 2669320), ('F1 25', 3059520), ('Final Fantasy VII Rebirth', 2909400), ('Forza Motorsport', 2440510),
  ('Grand Theft Auto Online', 271590), ('Jackbox Party Pack', 331670), ('Metaphor: ReFantazio', 2679460),
  ('MultiVersus', 1818750), ('NBA 2K25', 2878980), ('Naruto to Boruto: Shinobi Striker', 633230),
  ('Need for Speed Unbound', 1846380), ('New World: Aeternum', 1063730), ('Palia', 2707930), ('Peak', 3527290),
  ('Plants vs. Zombies', 3590), ('R.E.P.O.', 3241660), ('The Division 2', 2221490), ('The Sims 4', 1222670), ('osu!', 607260)
) AS v(name, appid)
WHERE g.name = v.name AND g.steam_appid IS NULL;

-- Portadas encontradas automáticamente: Steam o RAWG. Solo llena portadas vacías (o rotas, si se pide).
CREATE OR REPLACE FUNCTION public.set_game_covers(items jsonb) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE it jsonb; n integer := 0; url text; app bigint;
BEGIN
  IF (SELECT auth.uid()) IS NULL OR jsonb_typeof(items) <> 'array' THEN RETURN 0; END IF;
  FOR it IN SELECT * FROM jsonb_array_elements(items) LIMIT 60 LOOP
    url := it ->> 'url'; app := nullif(it ->> 'appid', '')::bigint;
    IF url IS NULL OR NOT (
         url ~ '^https://(shared|cdn)\.(akamai|cloudflare|fastly)\.steamstatic\.com/[A-Za-z0-9_./-]+\.(jpg|png)(\?[a-z0-9=&]*)?$'
      OR url ~ '^https://media\.rawg\.io/media/[A-Za-z0-9_./-]+\.(jpg|jpeg|png|webp)$') THEN CONTINUE; END IF;
    UPDATE public.games SET image_url = url, steam_appid = coalesce(steam_appid, app)
     WHERE id = (it ->> 'id')::bigint
       AND (image_url IS NULL OR ((image_url ~ 'steamstatic\.com' OR image_url ~ 'media\.rawg\.io') AND coalesce((it ->> 'replace')::boolean, false)));
    IF FOUND THEN n := n + 1; END IF;
  END LOOP;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.set_game_covers(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_game_covers(jsonb) TO authenticated;
COMMIT;

SELECT count(*) AS "Juegos", count(steam_appid) AS "Con portada de Steam", count(image_url) AS "Con portada guardada",
       count(*) FILTER (WHERE steam_appid IS NULL AND image_url IS NULL) AS "Usan portada de diseño (o RAWG)"
FROM public.games;
