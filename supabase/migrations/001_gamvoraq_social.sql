-- GAMVORAQ SOCIAL v3.0. Run ONCE in a NEW Supabase project.
-- Do not paste this over an existing v1/v2 schema. Make a backup first.
create extension if not exists pgcrypto;

create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 username text not null unique check(username ~ '^[a-z0-9_]{3,25}$'),
 display_name text not null default 'Gamer' check(char_length(display_name) between 1 and 60),
 bio text not null default '' check(char_length(bio)<=600),
 avatar_url text, cover_url text,
 platform text default 'Multiplataforma', play_style text default 'Casual',
 mic_preference text default 'Indistinto', schedule text default 'Variable',
 region text default '', looking_for boolean default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.games(id bigint generated always as identity primary key, name text not null unique, genre text, platform text, created_at timestamptz not null default now());
create table public.user_games(user_id uuid not null references public.profiles on delete cascade, game_id bigint not null references public.games on delete cascade, primary key(user_id,game_id));
create table public.follows(follower_id uuid not null references public.profiles on delete cascade,followed_id uuid not null references public.profiles on delete cascade,created_at timestamptz not null default now(),primary key(follower_id,followed_id), check(follower_id<>followed_id));
create table public.blocks(blocker_id uuid not null references public.profiles on delete cascade,blocked_id uuid not null references public.profiles on delete cascade,created_at timestamptz not null default now(),primary key(blocker_id,blocked_id),check(blocker_id<>blocked_id));
create table public.communities(id uuid primary key default gen_random_uuid(),owner_id uuid not null references public.profiles, name text not null check(char_length(name) between 3 and 65), description text not null default '' check(char_length(description)<=1000),cover_url text,created_at timestamptz not null default now());
create table public.community_members(community_id uuid references public.communities on delete cascade,user_id uuid references public.profiles on delete cascade,role text not null default 'member' check(role in ('owner','moderator','member')),joined_at timestamptz not null default now(),primary key(community_id,user_id));
create table public.posts(id uuid primary key default gen_random_uuid(),author_id uuid not null references public.profiles, community_id uuid references public.communities on delete set null,body text not null check(char_length(body) between 1 and 5000),created_at timestamptz not null default now());
create table public.post_images(id uuid primary key default gen_random_uuid(),post_id uuid not null references public.posts on delete cascade,url text not null,created_at timestamptz not null default now());
create table public.comments(id uuid primary key default gen_random_uuid(),post_id uuid not null references public.posts on delete cascade,author_id uuid not null references public.profiles,body text not null check(char_length(body) between 1 and 1200),created_at timestamptz not null default now());
create table public.post_reactions(post_id uuid not null references public.posts on delete cascade,user_id uuid not null references public.profiles on delete cascade,kind text not null check(kind in ('gg','ayuda','increible')),created_at timestamptz not null default now(),primary key(post_id,user_id));
create table public.channels(id uuid primary key default gen_random_uuid(),community_id uuid not null references public.communities on delete cascade,created_by uuid not null references public.profiles,title text not null check(char_length(title) between 3 and 70),description text default '',created_at timestamptz not null default now());
create table public.channel_messages(id uuid primary key default gen_random_uuid(),channel_id uuid not null references public.channels on delete cascade,author_id uuid not null references public.profiles,body text not null check(char_length(body) between 1 and 2000),created_at timestamptz not null default now());
create table public.gallery(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles on delete cascade,url text not null,caption text not null default '' check(char_length(caption)<=240),created_at timestamptz not null default now());
create table public.conversations(id uuid primary key default gen_random_uuid(),user_low uuid not null references public.profiles on delete cascade,user_high uuid not null references public.profiles on delete cascade,created_at timestamptz not null default now(),unique(user_low,user_high),check(user_low<user_high));
create table public.direct_messages(id uuid primary key default gen_random_uuid(),conversation_id uuid not null references public.conversations on delete cascade,sender_id uuid not null references public.profiles,body text not null check(char_length(body) between 1 and 2000),created_at timestamptz not null default now());
create table public.squads(id uuid primary key default gen_random_uuid(),owner_id uuid not null references public.profiles,name text not null check(char_length(name) between 3 and 60),description text not null default '' check(char_length(description)<=500),game_id bigint references public.games on delete set null,created_at timestamptz not null default now());
create table public.squad_members(squad_id uuid not null references public.squads on delete cascade,user_id uuid not null references public.profiles on delete cascade,role text not null default 'member' check(role in ('owner','member')),joined_at timestamptz not null default now(),primary key(squad_id,user_id));
create table public.squad_messages(id uuid primary key default gen_random_uuid(),squad_id uuid not null references public.squads on delete cascade,sender_id uuid not null references public.profiles,body text not null check(char_length(body) between 1 and 2000),created_at timestamptz not null default now());
create table public.quests(id uuid primary key default gen_random_uuid(),community_id uuid references public.communities on delete cascade,creator_id uuid not null references public.profiles,title text not null check(char_length(title) between 4 and 90),description text not null default '' check(char_length(description)<=1600),badge_name text not null default 'Compañero GG' check(char_length(badge_name) between 3 and 48),ends_at timestamptz,created_at timestamptz not null default now());
create table public.quest_entries(quest_id uuid not null references public.quests on delete cascade,user_id uuid not null references public.profiles on delete cascade,status text not null default 'joined' check(status in ('joined','submitted','approved','rejected')),proof text default '' check(char_length(proof)<=1600),reviewed_at timestamptz,created_at timestamptz not null default now(),primary key(quest_id,user_id));
create table public.badges(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles on delete cascade,quest_id uuid not null references public.quests on delete cascade,name text not null,awarded_at timestamptz not null default now(),unique(user_id,quest_id));
create table public.notifications(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles on delete cascade,actor_id uuid references public.profiles on delete set null,kind text not null,body text not null,ref_id uuid,read_at timestamptz,created_at timestamptz not null default now());
create table public.reports(id uuid primary key default gen_random_uuid(),reporter_id uuid not null references public.profiles,post_id uuid references public.posts on delete cascade,reported_user_id uuid references public.profiles,community_id uuid references public.communities on delete cascade,reason text not null check(reason in ('acoso','odio','spam','contenido','otro')),detail text not null default '' check(char_length(detail)<=1000),status text not null default 'open' check(status in ('open','reviewed','dismissed')),created_at timestamptz not null default now(),check(post_id is not null or reported_user_id is not null));

-- Internal helpers: do not rely on client-supplied ownership/role values.
create function public.is_community_staff(cid uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.community_members where community_id=cid and user_id=(select auth.uid()) and role in ('owner','moderator'))$$;
create function public.is_squad_member(sid uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.squad_members where squad_id=sid and user_id=(select auth.uid()))$$;
create function public.is_conversation_member(cid uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.conversations where id=cid and (user_low=(select auth.uid()) or user_high=(select auth.uid())))$$;
create function public.is_not_blocked(other_id uuid) returns boolean language sql stable security definer set search_path='' as $$select not exists(select 1 from public.blocks where (blocker_id=(select auth.uid()) and blocked_id=other_id) or (blocker_id=other_id and blocked_id=(select auth.uid())))$$;

create function public.on_auth_created() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.profiles(id,username,display_name)
 values(new.id,'gamer_'||substr(replace(new.id::text,'-',''),1,14),left(coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'),''),'Gamer'),60));
 return new;
end $$;
create trigger trg_user_profile after insert on auth.users for each row execute function public.on_auth_created();
create function public.on_community_created() returns trigger language plpgsql security definer set search_path='' as $$begin insert into public.community_members(community_id,user_id,role) values(new.id,new.owner_id,'owner');return new;end$$;
create trigger trg_community_owner after insert on public.communities for each row execute function public.on_community_created();
create function public.on_squad_created() returns trigger language plpgsql security definer set search_path='' as $$begin insert into public.squad_members(squad_id,user_id,role) values(new.id,new.owner_id,'owner');return new;end$$;
create trigger trg_squad_owner after insert on public.squads for each row execute function public.on_squad_created();
create function public.on_quest_approval() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status='approved' and old.status is distinct from 'approved' then
  insert into public.badges(user_id,quest_id,name) select new.user_id,new.quest_id,q.badge_name from public.quests q where q.id=new.quest_id on conflict do nothing;
  insert into public.notifications(user_id,kind,body,ref_id) values(new.user_id,'quest','¡Reto aprobado! Has ganado una insignia.',new.quest_id);
 end if;
 return new;
end$$;
create trigger trg_quest_badge after update on public.quest_entries for each row execute function public.on_quest_approval();
create function public.protect_report_identity() returns trigger language plpgsql set search_path='' as $$
begin
 if old.reporter_id is distinct from new.reporter_id or old.post_id is distinct from new.post_id or old.reported_user_id is distinct from new.reported_user_id or old.community_id is distinct from new.community_id or old.reason is distinct from new.reason or old.detail is distinct from new.detail then
  raise exception 'Report evidence cannot be altered';
 end if;
 return new;
end$$;
create trigger trg_protect_report before update on public.reports for each row execute function public.protect_report_identity();
create function public.on_new_dm() returns trigger language plpgsql security definer set search_path='' as $$
declare recipient uuid;
begin
 select case when user_low=new.sender_id then user_high else user_low end into recipient from public.conversations where id=new.conversation_id;
 insert into public.notifications(user_id,actor_id,kind,body,ref_id) values(recipient,new.sender_id,'message','Tienes un mensaje nuevo',new.conversation_id);
 return new;
end$$;
create trigger trg_new_dm after insert on public.direct_messages for each row execute function public.on_new_dm();
create function public.on_new_follow() returns trigger language plpgsql security definer set search_path='' as $$begin insert into public.notifications(user_id,actor_id,kind,body)values(new.followed_id,new.follower_id,'follow','Alguien comenzó a seguirte');return new;end$$;
create trigger trg_new_follow after insert on public.follows for each row execute function public.on_new_follow();

create index ix_posts_created on public.posts(created_at desc);create index ix_posts_author on public.posts(author_id);create index ix_posts_community on public.posts(community_id);
create index ix_comments_post on public.comments(post_id,created_at);create index ix_messages_convo on public.direct_messages(conversation_id,created_at);create index ix_squad_messages on public.squad_messages(squad_id,created_at);
create index ix_notifications_user on public.notifications(user_id,created_at desc);create index ix_user_games_game on public.user_games(game_id);create index ix_squad_member_user on public.squad_members(user_id);create index ix_community_member_user on public.community_members(user_id);create index ix_quest_entries_user on public.quest_entries(user_id);

-- Row level security for EVERY exposed app table.
do $$declare t text; begin foreach t in array array['profiles','games','user_games','follows','blocks','communities','community_members','posts','post_images','comments','post_reactions','channels','channel_messages','gallery','conversations','direct_messages','squads','squad_members','squad_messages','quests','quest_entries','badges','notifications','reports'] loop execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from anon, authenticated',t);execute format('grant select,insert,update,delete on public.%I to authenticated',t);end loop;end$$;
grant usage on schema public to authenticated;
grant usage,select on all sequences in schema public to authenticated;
grant execute on function public.is_community_staff(uuid),public.is_squad_member(uuid),public.is_conversation_member(uuid),public.is_not_blocked(uuid) to authenticated;

create policy "profiles_read" on public.profiles for select to authenticated using(true);
create policy "profiles_update" on public.profiles for update to authenticated using(id=(select auth.uid())) with check(id=(select auth.uid()));
create policy "games_read" on public.games for select to authenticated using(true);
create policy "user_games_read" on public.user_games for select to authenticated using(true);
create policy "user_games_add" on public.user_games for insert to authenticated with check(user_id=(select auth.uid()));
create policy "user_games_delete" on public.user_games for delete to authenticated using(user_id=(select auth.uid()));
create policy "follows_read" on public.follows for select to authenticated using(true);
create policy "follows_add" on public.follows for insert to authenticated with check(follower_id=(select auth.uid()) and public.is_not_blocked(followed_id));
create policy "follows_remove" on public.follows for delete to authenticated using(follower_id=(select auth.uid()));
create policy "blocks_read" on public.blocks for select to authenticated using(blocker_id=(select auth.uid()));
create policy "blocks_add" on public.blocks for insert to authenticated with check(blocker_id=(select auth.uid()));
create policy "blocks_remove" on public.blocks for delete to authenticated using(blocker_id=(select auth.uid()));
create policy "communities_read" on public.communities for select to authenticated using(true);
create policy "communities_add" on public.communities for insert to authenticated with check(owner_id=(select auth.uid()));
create policy "communities_update" on public.communities for update to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
create policy "communities_delete" on public.communities for delete to authenticated using(owner_id=(select auth.uid()));
create policy "members_read" on public.community_members for select to authenticated using(true);
create policy "members_join" on public.community_members for insert to authenticated with check(user_id=(select auth.uid()) and role='member');
create policy "members_leave" on public.community_members for delete to authenticated using(user_id=(select auth.uid()) and role='member');
create policy "posts_read" on public.posts for select to authenticated using(true);
create policy "posts_add" on public.posts for insert to authenticated with check(author_id=(select auth.uid()) and (community_id is null or exists(select 1 from public.community_members where community_id=posts.community_id and user_id=(select auth.uid()))));
create policy "posts_update" on public.posts for update to authenticated using(author_id=(select auth.uid())) with check(author_id=(select auth.uid()) and (community_id is null or exists(select 1 from public.community_members where community_id=posts.community_id and user_id=(select auth.uid()))));
create policy "posts_delete" on public.posts for delete to authenticated using(author_id=(select auth.uid()) or (community_id is not null and public.is_community_staff(community_id)));
create policy "images_read" on public.post_images for select to authenticated using(true);
create policy "images_add" on public.post_images for insert to authenticated with check(exists(select 1 from public.posts p where p.id=post_id and p.author_id=(select auth.uid())));
create policy "images_delete" on public.post_images for delete to authenticated using(exists(select 1 from public.posts p where p.id=post_id and p.author_id=(select auth.uid())));
create policy "comments_read" on public.comments for select to authenticated using(true);
create policy "comments_add" on public.comments for insert to authenticated with check(author_id=(select auth.uid()));
create policy "comments_delete" on public.comments for delete to authenticated using(author_id=(select auth.uid()) or exists(select 1 from public.posts p where p.id=post_id and p.community_id is not null and public.is_community_staff(p.community_id)));
create policy "reactions_read" on public.post_reactions for select to authenticated using(true);
create policy "reactions_add" on public.post_reactions for insert to authenticated with check(user_id=(select auth.uid()));
create policy "reactions_edit" on public.post_reactions for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy "reactions_remove" on public.post_reactions for delete to authenticated using(user_id=(select auth.uid()));
create policy "channels_read" on public.channels for select to authenticated using(true);
create policy "channels_add" on public.channels for insert to authenticated with check(created_by=(select auth.uid()) and public.is_community_staff(community_id));
create policy "channel_msgs_read" on public.channel_messages for select to authenticated using(true);
create policy "channel_msgs_add" on public.channel_messages for insert to authenticated with check(author_id=(select auth.uid()) and exists(select 1 from public.channels ch where ch.id=channel_id and public.is_community_staff(ch.community_id)));
create policy "gallery_read" on public.gallery for select to authenticated using(true);
create policy "gallery_add" on public.gallery for insert to authenticated with check(user_id=(select auth.uid()));
create policy "gallery_delete" on public.gallery for delete to authenticated using(user_id=(select auth.uid()));
create policy "conversations_read" on public.conversations for select to authenticated using(user_low=(select auth.uid()) or user_high=(select auth.uid()));
create policy "conversations_create" on public.conversations for insert to authenticated with check((user_low=(select auth.uid()) or user_high=(select auth.uid())) and public.is_not_blocked(case when user_low=(select auth.uid()) then user_high else user_low end));
create policy "dms_read" on public.direct_messages for select to authenticated using(public.is_conversation_member(conversation_id));
create policy "dms_send" on public.direct_messages for insert to authenticated with check(sender_id=(select auth.uid()) and public.is_conversation_member(conversation_id) and exists(select 1 from public.conversations c where c.id=conversation_id and public.is_not_blocked(case when c.user_low=(select auth.uid()) then c.user_high else c.user_low end)));
create policy "squads_read" on public.squads for select to authenticated using(true);
create policy "squads_add" on public.squads for insert to authenticated with check(owner_id=(select auth.uid()));
create policy "squads_edit" on public.squads for update to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
create policy "squad_members_read" on public.squad_members for select to authenticated using(true);
create policy "squad_members_join" on public.squad_members for insert to authenticated with check(user_id=(select auth.uid()) and role='member');
create policy "squad_members_leave" on public.squad_members for delete to authenticated using(user_id=(select auth.uid()) and role='member');
create policy "squad_messages_read" on public.squad_messages for select to authenticated using(public.is_squad_member(squad_id));
create policy "squad_messages_add" on public.squad_messages for insert to authenticated with check(sender_id=(select auth.uid()) and public.is_squad_member(squad_id));
create policy "quests_read" on public.quests for select to authenticated using(true);
create policy "quests_create" on public.quests for insert to authenticated with check(creator_id=(select auth.uid()) and (community_id is null or public.is_community_staff(community_id)));
create policy "quest_entries_read" on public.quest_entries for select to authenticated using(user_id=(select auth.uid()) or exists(select 1 from public.quests q where q.id=quest_id and (q.creator_id=(select auth.uid()) or (q.community_id is not null and public.is_community_staff(q.community_id)))));
create policy "quest_entries_join" on public.quest_entries for insert to authenticated with check(user_id=(select auth.uid()) and status='joined' and coalesce(proof,'')='' and exists(select 1 from public.quests q where q.id=quest_id and (q.ends_at is null or q.ends_at>now())));
create policy "quest_entries_submit" on public.quest_entries for update to authenticated using(user_id=(select auth.uid()) and status in ('joined','rejected')) with check(user_id=(select auth.uid()) and status='submitted' and length(trim(proof))>=5 and reviewed_at is null);
create policy "quest_entries_review" on public.quest_entries for update to authenticated using(status='submitted' and user_id<>(select auth.uid()) and exists(select 1 from public.quests q where q.id=quest_id and (q.creator_id=(select auth.uid()) or (q.community_id is not null and public.is_community_staff(q.community_id))))) with check(status in ('approved','rejected') and user_id<>(select auth.uid()));
create policy "badges_read" on public.badges for select to authenticated using(true);
create policy "notifications_read" on public.notifications for select to authenticated using(user_id=(select auth.uid()));
create policy "notifications_ack" on public.notifications for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy "reports_add" on public.reports for insert to authenticated with check(reporter_id=(select auth.uid()) and status='open' and (community_id is null or (post_id is not null and exists(select 1 from public.posts p where p.id=post_id and p.community_id=reports.community_id))));
create policy "reports_read" on public.reports for select to authenticated using(reporter_id=(select auth.uid()) or (community_id is not null and public.is_community_staff(community_id)));
create policy "reports_review" on public.reports for update to authenticated using(community_id is not null and public.is_community_staff(community_id)) with check(community_id is not null and public.is_community_staff(community_id));

-- Storage: shared public image bucket; only upload into folders owned by the logged-in user.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('gamvoraq','gamvoraq',true,5242880,array['image/jpeg','image/png','image/webp','image/gif']) on conflict(id) do update set public=true,file_size_limit=5242880,allowed_mime_types=excluded.allowed_mime_types;
create policy "gamvoraq_upload_own" on storage.objects for insert to authenticated with check(bucket_id='gamvoraq' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "gamvoraq_delete_own" on storage.objects for delete to authenticated using(bucket_id='gamvoraq' and (storage.foldername(name))[1]=(select auth.uid())::text);

-- Public game catalog: enough real seed entries to search; expand by SQL or import later.
insert into public.games(name,genre,platform) values
('Minecraft','Sandbox','Multiplataforma'),('Roblox','Sandbox','Multiplataforma'),('Fortnite','Battle royale','Multiplataforma'),('Valorant','FPS','PC'),('League of Legends','MOBA','PC'),('Dota 2','MOBA','PC'),('Counter-Strike 2','FPS','PC'),('Apex Legends','Battle royale','Multiplataforma'),('Call of Duty: Warzone','FPS','Multiplataforma'),('Call of Duty: Black Ops 6','FPS','Multiplataforma'),('Overwatch 2','Hero shooter','Multiplataforma'),('Rocket League','Deportes','Multiplataforma'),('Genshin Impact','RPG','Multiplataforma'),('Honkai: Star Rail','RPG','Multiplataforma'),('Zenless Zone Zero','RPG','Multiplataforma'),('Wuthering Waves','RPG','Multiplataforma'),('Grand Theft Auto V','Acción','Multiplataforma'),('Grand Theft Auto Online','Online','Multiplataforma'),('Red Dead Redemption 2','Aventura','Multiplataforma'),('EA Sports FC 25','Deportes','Multiplataforma'),('EA Sports FC 26','Deportes','Multiplataforma'),('NBA 2K25','Deportes','Multiplataforma'),('NBA 2K26','Deportes','Multiplataforma'),('eFootball','Deportes','Multiplataforma'),('Fall Guys','Party','Multiplataforma'),('Among Us','Social','Multiplataforma'),('Phasmophobia','Terror','Multiplataforma'),('Dead by Daylight','Terror','Multiplataforma'),('Lethal Company','Terror','PC'),('Content Warning','Party','PC'),('R.E.P.O.','Cooperativo','PC'),('It Takes Two','Cooperativo','Multiplataforma'),('A Way Out','Cooperativo','Multiplataforma'),('Terraria','Sandbox','Multiplataforma'),('Stardew Valley','Simulación','Multiplataforma'),('Palworld','Supervivencia','Multiplataforma'),('ARK: Survival Ascended','Supervivencia','Multiplataforma'),('Rust','Supervivencia','PC'),('DayZ','Supervivencia','Multiplataforma'),('7 Days to Die','Supervivencia','Multiplataforma'),('Sons of the Forest','Supervivencia','PC'),('The Forest','Supervivencia','Multiplataforma'),('Project Zomboid','Supervivencia','PC'),('Valheim','Supervivencia','Multiplataforma'),('No Man''s Sky','Exploración','Multiplataforma'),('Sea of Thieves','Aventura','Multiplataforma'),('Destiny 2','Acción','Multiplataforma'),('Warframe','Acción','Multiplataforma'),('The Finals','FPS','Multiplataforma'),('Rainbow Six Siege','FPS','Multiplataforma'),('PUBG: Battlegrounds','Battle royale','Multiplataforma'),('Battlefield 2042','FPS','Multiplataforma'),('Battlefield 6','FPS','Multiplataforma'),('Escape from Tarkov','FPS','PC'),('Hunt: Showdown 1896','FPS','Multiplataforma'),('The Division 2','Acción','Multiplataforma'),('Helldivers 2','Cooperativo','Multiplataforma'),('Deep Rock Galactic','Cooperativo','Multiplataforma'),('Monster Hunter Wilds','RPG','Multiplataforma'),('Monster Hunter Rise','RPG','Multiplataforma'),('Monster Hunter World','RPG','Multiplataforma'),('Elden Ring','RPG','Multiplataforma'),('Dark Souls III','RPG','Multiplataforma'),('Sekiro: Shadows Die Twice','RPG','Multiplataforma'),('Bloodborne','RPG','PlayStation'),('Hollow Knight','Metroidvania','Multiplataforma'),('Hades','Roguelike','Multiplataforma'),('Hades II','Roguelike','Multiplataforma'),('Celeste','Plataformas','Multiplataforma'),('Cuphead','Plataformas','Multiplataforma'),('Ori and the Will of the Wisps','Plataformas','Multiplataforma'),('Undertale','RPG','Multiplataforma'),('Deltarune','RPG','Multiplataforma'),('Persona 5 Royal','RPG','Multiplataforma'),('Metaphor: ReFantazio','RPG','Multiplataforma'),('Final Fantasy XIV','MMORPG','Multiplataforma'),('Final Fantasy VII Rebirth','RPG','Multiplataforma'),('World of Warcraft','MMORPG','PC'),('Guild Wars 2','MMORPG','PC'),('Black Desert Online','MMORPG','Multiplataforma'),('Lost Ark','MMORPG','PC'),('New World: Aeternum','MMORPG','Multiplataforma'),('The Elder Scrolls Online','MMORPG','Multiplataforma'),('Baldur''s Gate 3','RPG','Multiplataforma'),('Divinity: Original Sin 2','RPG','Multiplataforma'),('Diablo IV','RPG','Multiplataforma'),('Path of Exile','RPG','Multiplataforma'),('Path of Exile 2','RPG','Multiplataforma'),('Cyberpunk 2077','RPG','Multiplataforma'),('The Witcher 3','RPG','Multiplataforma'),('Skyrim','RPG','Multiplataforma'),('Fallout 4','RPG','Multiplataforma'),('Fallout 76','Online','Multiplataforma'),('Starfield','RPG','Multiplataforma'),('Forza Horizon 5','Carreras','Multiplataforma'),('Forza Motorsport','Carreras','Multiplataforma'),('Gran Turismo 7','Carreras','PlayStation'),('Need for Speed Unbound','Carreras','Multiplataforma'),('Assetto Corsa Competizione','Simulación','Multiplataforma'),('F1 25','Carreras','Multiplataforma'),('Mario Kart 8 Deluxe','Carreras','Nintendo'),('Mario Kart World','Carreras','Nintendo'),('Super Smash Bros. Ultimate','Peleas','Nintendo'),('Street Fighter 6','Peleas','Multiplataforma'),('Tekken 8','Peleas','Multiplataforma'),('Mortal Kombat 1','Peleas','Multiplataforma'),('Brawlhalla','Peleas','Multiplataforma'),('MultiVersus','Peleas','Multiplataforma'),('Pokémon Scarlet','RPG','Nintendo'),('Pokémon Violet','RPG','Nintendo'),('Pokémon Legends: Arceus','RPG','Nintendo'),('Pokémon Legends: Z-A','RPG','Nintendo'),('The Legend of Zelda: Breath of the Wild','Aventura','Nintendo'),('The Legend of Zelda: Tears of the Kingdom','Aventura','Nintendo'),('Animal Crossing: New Horizons','Simulación','Nintendo'),('Splatoon 3','Shooter','Nintendo'),('Pikmin 4','Estrategia','Nintendo'),('Super Mario Odyssey','Plataformas','Nintendo'),('Super Mario Bros. Wonder','Plataformas','Nintendo'),('Dragon Ball: Sparking! ZERO','Peleas','Multiplataforma'),('Dragon Ball FighterZ','Peleas','Multiplataforma'),('Naruto to Boruto: Shinobi Striker','Acción','Multiplataforma'),('Yu-Gi-Oh! Master Duel','Cartas','Multiplataforma'),('Marvel Rivals','Hero shooter','Multiplataforma'),('Marvel Snap','Cartas','Multiplataforma'),('Teamfight Tactics','Estrategia','Multiplataforma'),('Legends of Runeterra','Cartas','Multiplataforma'),('Clash Royale','Estrategia','Móvil'),('Clash of Clans','Estrategia','Móvil'),('Brawl Stars','Acción','Móvil'),('Mobile Legends: Bang Bang','MOBA','Móvil'),('Honor of Kings','MOBA','Móvil'),('Free Fire','Battle royale','Móvil'),('PUBG Mobile','Battle royale','Móvil'),('Call of Duty Mobile','FPS','Móvil'),('Pokémon GO','Aventura','Móvil'),('Geometry Dash','Ritmo','Multiplataforma'),('osu!','Ritmo','PC'),('Beat Saber','Ritmo','VR'),('VRChat','Social','VR'),('Rec Room','Social','Multiplataforma'),('Gorilla Tag','Social','VR'),('Palia','Simulación','Multiplataforma'),('Dinkum','Simulación','PC'),('Core Keeper','Sandbox','Multiplataforma'),('Don''t Starve Together','Supervivencia','Multiplataforma'),('Grounded','Supervivencia','Multiplataforma'),('Raft','Supervivencia','PC'),('Subnautica','Supervivencia','Multiplataforma'),('Factorio','Simulación','PC'),('Satisfactory','Simulación','PC'),('Cities: Skylines II','Simulación','PC'),('The Sims 4','Simulación','Multiplataforma'),('Civilization VI','Estrategia','Multiplataforma'),('Civilization VII','Estrategia','Multiplataforma'),('Age of Empires IV','Estrategia','Multiplataforma'),('Age of Empires II: Definitive Edition','Estrategia','Multiplataforma'),('StarCraft II','Estrategia','PC'),('Bloons TD 6','Estrategia','Multiplataforma'),('Plants vs. Zombies','Estrategia','Multiplataforma'),('Slay the Spire','Cartas','Multiplataforma'),('Balatro','Cartas','Multiplataforma'),('Inscryption','Cartas','Multiplataforma'),('Risk of Rain 2','Roguelike','Multiplataforma'),('Enter the Gungeon','Roguelike','Multiplataforma'),('Vampire Survivors','Roguelike','Multiplataforma'),('Cult of the Lamb','Roguelike','Multiplataforma'),('Binding of Isaac: Rebirth','Roguelike','Multiplataforma'),('Dying Light 2','Acción','Multiplataforma'),('Left 4 Dead 2','FPS','PC'),('Back 4 Blood','FPS','Multiplataforma'),('Payday 3','FPS','Multiplataforma'),('Ready or Not','FPS','PC'),('Insurgency: Sandstorm','FPS','Multiplataforma'),('Garry''s Mod','Sandbox','PC'),('Team Fortress 2','FPS','PC'),('Portal 2','Puzzle','PC'),('Human: Fall Flat','Puzzle','Multiplataforma'),('Gang Beasts','Party','Multiplataforma'),('Party Animals','Party','Multiplataforma'),('Pummel Party','Party','PC'),('Jackbox Party Pack','Party','Multiplataforma'),('Golf With Your Friends','Party','Multiplataforma'),('Overcooked! 2','Cooperativo','Multiplataforma'),('Moving Out 2','Cooperativo','Multiplataforma'),('Unrailed!','Cooperativo','Multiplataforma'),('PlateUp!','Cooperativo','Multiplataforma'),('Keep Talking and Nobody Explodes','Cooperativo','Multiplataforma'),('Chained Together','Cooperativo','PC'),('Peak','Cooperativo','PC') on conflict(name) do nothing;

-- Postgres Changes realtime: only the tables needed for chat/notifs, with RLS filtering.
do $$begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
  begin alter publication supabase_realtime add table public.direct_messages,public.squad_messages,public.channel_messages,public.notifications;
  exception when duplicate_object then null; end;
 end if;
end $$;
