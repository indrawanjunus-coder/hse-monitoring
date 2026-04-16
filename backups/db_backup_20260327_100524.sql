--
-- PostgreSQL database dump
--

\restrict 96GAMuqTv3cPRzmVTnMKbCyHi7qyub65IMSJacVwX1t5CqnuFwN1vcxMoxavseu

-- Dumped from database version 16.10
-- Dumped by pg_dump version 16.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: actions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.actions (
    id integer NOT NULL,
    name text NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: actions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.actions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: actions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.actions_id_seq OWNED BY public.actions.id;


--
-- Name: categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categories (
    id integer NOT NULL,
    name text NOT NULL,
    description text,
    risk_level text DEFAULT 'low'::text NOT NULL,
    pic_group_id integer,
    color text DEFAULT '#3B82F6'::text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: categories_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.categories_id_seq OWNED BY public.categories.id;


--
-- Name: departments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.departments (
    id integer NOT NULL,
    name text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: departments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.departments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: departments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.departments_id_seq OWNED BY public.departments.id;


--
-- Name: group_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.group_members (
    id integer NOT NULL,
    group_id integer NOT NULL,
    user_id integer NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: group_members_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.group_members_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: group_members_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.group_members_id_seq OWNED BY public.group_members.id;


--
-- Name: groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.groups (
    id integer NOT NULL,
    name text NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: groups_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.groups_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: groups_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.groups_id_seq OWNED BY public.groups.id;


--
-- Name: incidents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.incidents (
    id integer NOT NULL,
    reporter_id integer NOT NULL,
    plant_id integer NOT NULL,
    category_id integer NOT NULL,
    incident_date text NOT NULL,
    reported_date text NOT NULL,
    detail text NOT NULL,
    action_id integer,
    needs_further_action boolean DEFAULT false NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    closed_at text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    assigned_group_id integer,
    followup_note text
);


--
-- Name: incidents_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.incidents_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: incidents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.incidents_id_seq OWNED BY public.incidents.id;


--
-- Name: inspection_answers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inspection_answers (
    id integer NOT NULL,
    inspection_id integer NOT NULL,
    question_id integer NOT NULL,
    answer_yes_no boolean,
    answer_text text,
    photo_url text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: inspection_answers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.inspection_answers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: inspection_answers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.inspection_answers_id_seq OWNED BY public.inspection_answers.id;


--
-- Name: inspections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inspections (
    id integer NOT NULL,
    schedule_id integer NOT NULL,
    supervisor_id integer NOT NULL,
    plant_id integer,
    template_id integer NOT NULL,
    inspected_at text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: inspections_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.inspections_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: inspections_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.inspections_id_seq OWNED BY public.inspections.id;


--
-- Name: plants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plants (
    id integer NOT NULL,
    name text NOT NULL,
    code text NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: plants_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.plants_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: plants_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.plants_id_seq OWNED BY public.plants.id;


--
-- Name: questions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.questions (
    id integer NOT NULL,
    template_id integer NOT NULL,
    text text NOT NULL,
    answer_type text DEFAULT 'yes_no'::text NOT NULL,
    is_mandatory boolean DEFAULT true NOT NULL,
    requires_photo boolean DEFAULT false NOT NULL,
    category_id integer,
    order_index integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    expected_answer text
);


--
-- Name: questions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.questions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: questions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.questions_id_seq OWNED BY public.questions.id;


--
-- Name: schedule_groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schedule_groups (
    id integer NOT NULL,
    schedule_id integer NOT NULL,
    group_id integer NOT NULL
);


--
-- Name: schedule_groups_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.schedule_groups_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: schedule_groups_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.schedule_groups_id_seq OWNED BY public.schedule_groups.id;


--
-- Name: schedule_users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schedule_users (
    id integer NOT NULL,
    schedule_id integer NOT NULL,
    user_id integer NOT NULL
);


--
-- Name: schedule_users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.schedule_users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: schedule_users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.schedule_users_id_seq OWNED BY public.schedule_users.id;


--
-- Name: schedules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schedules (
    id integer NOT NULL,
    supervisor_id integer,
    template_id integer NOT NULL,
    plant_id integer NOT NULL,
    week_start text,
    week_end text,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    group_id integer,
    frequency text DEFAULT 'weekly'::text NOT NULL,
    day_of_week integer,
    day_of_month integer,
    custom_days text,
    is_active integer DEFAULT 1 NOT NULL,
    title text
);


--
-- Name: schedules_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.schedules_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: schedules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.schedules_id_seq OWNED BY public.schedules.id;


--
-- Name: smtp_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.smtp_settings (
    id integer NOT NULL,
    host text DEFAULT ''::text NOT NULL,
    port integer DEFAULT 587 NOT NULL,
    protocol text DEFAULT 'STARTTLS'::text NOT NULL,
    username text DEFAULT ''::text NOT NULL,
    password text DEFAULT ''::text NOT NULL,
    from_name text DEFAULT 'HSE System'::text NOT NULL,
    from_email text DEFAULT ''::text NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: smtp_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.smtp_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: smtp_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.smtp_settings_id_seq OWNED BY public.smtp_settings.id;


--
-- Name: templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.templates (
    id integer NOT NULL,
    name text NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: templates_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.templates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: templates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.templates_id_seq OWNED BY public.templates.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id integer NOT NULL,
    nik text NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    password_hash text NOT NULL,
    role text DEFAULT 'employee'::text NOT NULL,
    department_id integer,
    is_head boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: actions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.actions ALTER COLUMN id SET DEFAULT nextval('public.actions_id_seq'::regclass);


--
-- Name: categories id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories ALTER COLUMN id SET DEFAULT nextval('public.categories_id_seq'::regclass);


--
-- Name: departments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments ALTER COLUMN id SET DEFAULT nextval('public.departments_id_seq'::regclass);


--
-- Name: group_members id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_members ALTER COLUMN id SET DEFAULT nextval('public.group_members_id_seq'::regclass);


--
-- Name: groups id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.groups ALTER COLUMN id SET DEFAULT nextval('public.groups_id_seq'::regclass);


--
-- Name: incidents id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incidents ALTER COLUMN id SET DEFAULT nextval('public.incidents_id_seq'::regclass);


--
-- Name: inspection_answers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inspection_answers ALTER COLUMN id SET DEFAULT nextval('public.inspection_answers_id_seq'::regclass);


--
-- Name: inspections id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inspections ALTER COLUMN id SET DEFAULT nextval('public.inspections_id_seq'::regclass);


--
-- Name: plants id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plants ALTER COLUMN id SET DEFAULT nextval('public.plants_id_seq'::regclass);


--
-- Name: questions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.questions ALTER COLUMN id SET DEFAULT nextval('public.questions_id_seq'::regclass);


--
-- Name: schedule_groups id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_groups ALTER COLUMN id SET DEFAULT nextval('public.schedule_groups_id_seq'::regclass);


--
-- Name: schedule_users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_users ALTER COLUMN id SET DEFAULT nextval('public.schedule_users_id_seq'::regclass);


--
-- Name: schedules id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedules ALTER COLUMN id SET DEFAULT nextval('public.schedules_id_seq'::regclass);


--
-- Name: smtp_settings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.smtp_settings ALTER COLUMN id SET DEFAULT nextval('public.smtp_settings_id_seq'::regclass);


--
-- Name: templates id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.templates ALTER COLUMN id SET DEFAULT nextval('public.templates_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Data for Name: actions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.actions (id, name, description, created_at) FROM stdin;
1	Isolasi Area	Memasang pagar pembatas area berbahaya	2026-03-26 06:51:36.297127
2	Pelaporan ke Atasan	Melaporkan incident ke supervisor/manager	2026-03-26 06:51:36.297127
3	Pertolongan Pertama	Memberikan pertolongan pertama pada korban	2026-03-26 06:51:36.297127
4	Perbaikan Peralatan	Memperbaiki peralatan yang rusak	2026-03-26 06:51:36.297127
5	Pelatihan Ulang	Mengadakan pelatihan keselamatan ulang	2026-03-26 06:51:36.297127
6	Stop Operasi	Menghentikan operasi sementara	2026-03-26 06:51:36.297127
\.


--
-- Data for Name: categories; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.categories (id, name, description, risk_level, pic_group_id, color, created_at) FROM stdin;
1	Safety	Safety related incidents	high	1	#EF4444	2026-03-26 06:51:36.297127
2	Environment	Environmental incidents	medium	2	#22C55E	2026-03-26 06:51:36.297127
3	Health	Health related incidents	medium	3	#3B82F6	2026-03-26 06:51:36.297127
4	Quality	Quality issues	low	4	#F59E0B	2026-03-26 06:51:36.297127
5	Cybersecurity	\N	high	6	#EF4444	2026-03-27 09:51:26.229671
\.


--
-- Data for Name: departments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.departments (id, name, created_at) FROM stdin;
1	HSE Department	2026-03-26 06:51:36.297127
2	Production	2026-03-26 06:51:36.297127
3	Maintenance	2026-03-26 06:51:36.297127
4	Quality Control	2026-03-26 06:51:36.297127
\.


--
-- Data for Name: group_members; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.group_members (id, group_id, user_id, created_at) FROM stdin;
1	1	1	2026-03-26 06:52:33.832803
2	1	2	2026-03-26 06:52:33.832803
3	2	3	2026-03-26 06:52:33.832803
4	3	4	2026-03-26 06:52:33.832803
5	4	5	2026-03-26 06:52:33.832803
6	5	1	2026-03-27 07:04:16.652539
7	6	1	2026-03-27 09:52:07.650603
\.


--
-- Data for Name: groups; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.groups (id, name, description, created_at) FROM stdin;
1	Safety Team	Responsible for safety incidents	2026-03-26 06:51:36.297127
2	Environment Team	Responsible for environment incidents	2026-03-26 06:51:36.297127
3	Health Team	Responsible for health incidents	2026-03-26 06:51:36.297127
4	Quality Team	Quality assurance group	2026-03-26 06:51:36.297127
5	Tim Safety Baru	\N	2026-03-27 07:04:16.617498
6	IT Team	\N	2026-03-27 09:50:56.828262
\.


--
-- Data for Name: incidents; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.incidents (id, reporter_id, plant_id, category_id, incident_date, reported_date, detail, action_id, needs_further_action, status, closed_at, created_at, assigned_group_id, followup_note) FROM stdin;
8	2	2	1	2026-03-02	2026-03-02	Helm safety tidak tersedia dalam jumlah cukup di area kerja	1	f	closed	\N	2026-03-26 06:52:33.832803	\N	\N
6	4	2	1	2026-03-06	2026-03-06	Pagar pembatas area berbahaya rusak dan perlu diperbaiki segera	4	t	in_progress	\N	2026-03-26 06:52:33.832803	\N	\N
5	3	1	4	2026-03-08	2026-03-08	Produk batch QC-2025-03 tidak memenuhi standar kualitas yang ditetapkan	2	f	closed	\N	2026-03-26 06:52:33.832803	\N	\N
4	2	2	1	2026-03-10	2026-03-10	APAR di area penyimpanan bahan baku telah melewati tanggal kadaluarsa	4	t	open	\N	2026-03-26 06:52:33.832803	\N	\N
3	4	1	3	2026-03-13	2026-03-13	Karyawan mengalami iritasi mata akibat paparan debu produksi tanpa APD yang memadai	3	f	closed	\N	2026-03-26 06:52:33.832803	\N	\N
2	5	2	2	2026-03-15	2026-03-15	Emisi asap berlebihan dari cerobong area Cold End melebihi batas yang ditentukan	2	t	in_progress	\N	2026-03-26 06:52:33.832803	\N	\N
1	4	1	1	2026-03-18	2026-03-18	Ditemukan tumpahan oli mesin di area produksi Hot End, berpotensi menyebabkan kecelakaan kerja	1	t	open	\N	2026-03-26 06:52:33.832803	\N	\N
9	2	1	1	2026-03-01	2026-03-01	Pekerja tidak menggunakan helm pelindung di area loading. Telah diperingatkan dan diberikan APD.	\N	f	closed	\N	2026-03-27 06:45:32.771936	\N	\N
10	3	2	2	2026-03-03	2026-03-03	Tumpahan cairan coolant di area mesin pendingin. Dibersihkan segera oleh tim maintenance.	\N	f	closed	\N	2026-03-27 06:45:32.771936	\N	\N
11	4	1	3	2026-03-05	2026-03-05	Karyawan melaporkan pusing dan mual akibat paparan debu berlebih di area grinding.	\N	t	in_progress	\N	2026-03-27 06:45:32.771936	\N	\N
12	5	2	4	2026-03-07	2026-03-07	Produk cacat lolos dari proses QC sehingga perlu dilakukan recall internal.	\N	t	open	\N	2026-03-27 06:45:32.771936	\N	\N
13	2	1	1	2026-03-09	2026-03-09	Tangga scaffolding tidak terpasang dengan benar, berpotensi jatuh. Dihentikan operasinya.	\N	f	closed	\N	2026-03-27 06:45:32.771936	\N	\N
14	3	1	2	2026-03-11	2026-03-11	Emisi asap berlebih dari cerobong kiln melebihi batas normal. Tim lingkungan menyelidiki.	\N	t	in_progress	\N	2026-03-27 06:45:32.771936	\N	\N
15	4	2	1	2026-03-14	2026-03-14	APAR di zona B6 kadaluwarsa. Segera diganti dengan yang baru.	\N	f	closed	\N	2026-03-27 06:45:32.771936	\N	\N
16	5	1	3	2026-03-16	2026-03-16	Operator forklift mengalami nyeri punggung akibat postur kerja yang salah.	\N	f	open	\N	2026-03-27 06:45:32.771936	\N	\N
17	2	2	4	2026-03-17	2026-03-17	Kesalahan pengukuran suhu pada batch produksi KL-2026-031. Produk ditahan untuk inspeksi ulang.	\N	t	in_progress	\N	2026-03-27 06:45:32.771936	\N	\N
18	3	1	1	2026-03-19	2026-03-19	Kabel listrik terbuka di area workshop. Dilaporkan dan diperbaiki oleh teknisi.	\N	f	closed	\N	2026-03-27 06:45:32.771936	\N	\N
19	4	2	2	2026-03-20	2026-03-20	Limbah cair dibuang tidak sesuai prosedur. Peringatan diberikan ke operator yang bersangkutan.	\N	t	open	\N	2026-03-27 06:45:32.771936	\N	\N
20	5	1	1	2026-03-21	2026-03-21	Kebocoran gas hidrogen terdeteksi di ruang kompresor. Evakuasi sementara dilakukan.	\N	t	in_progress	\N	2026-03-27 06:45:32.771936	\N	\N
21	2	2	3	2026-03-22	2026-03-22	Laporan ergonomi: meja kerja terlalu tinggi untuk operator. Penyesuaian workstation diperlukan.	\N	f	open	\N	2026-03-27 06:45:32.771936	\N	\N
22	3	1	4	2026-03-24	2026-03-24	Data kalibrasi timbangan tidak diperbarui selama 3 bulan. Kalibrasi ulang dijadwalkan.	\N	f	closed	\N	2026-03-27 06:45:32.771936	\N	\N
23	4	1	1	2026-03-25	2026-03-25	Pekerja terpeleset di area basah dekat cooling tower. Tidak ada cedera serius.	\N	f	in_progress	\N	2026-03-27 06:45:32.771936	\N	\N
24	5	2	2	2026-03-26	2026-03-26	Filter udara HVAC perlu diganti, kualitas udara dalam ruangan menurun.	\N	f	open	\N	2026-03-27 06:45:32.771936	\N	\N
25	2	1	1	2026-03-27	2026-03-27	Palang pengaman mesin press tidak berfungsi, dihentikan dari produksi untuk perbaikan.	\N	t	open	\N	2026-03-27 06:45:32.771936	\N	\N
7	5	1	2	2026-03-04	2026-03-04	Sistem filtrasi air limbah tidak berfungsi optimal	6	t	in_progress	\N	2026-03-26 06:52:33.832803	\N	\N
26	1	1	5	2026-03-27	2026-03-27	[Auto] Jawaban tidak sesuai harapan. Pertanyaan: "Apakah ada Serangan Cyber?" — Diharapkan: Tidak, Dijawab: Ya	1	t	closed	2026-03-27	2026-03-27 09:56:30.367375	\N	\N
\.


--
-- Data for Name: inspection_answers; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.inspection_answers (id, inspection_id, question_id, answer_yes_no, answer_text, photo_url, created_at) FROM stdin;
1	1	1	t	\N	\N	2026-03-27 07:39:35.47533
2	1	2	t	\N	\N	2026-03-27 07:39:35.47533
3	1	3	t	\N	\N	2026-03-27 07:39:35.47533
4	1	4	t	\N	\N	2026-03-27 07:39:35.47533
5	1	5	t	\N	\N	2026-03-27 07:39:35.47533
6	1	6	\N	ok	\N	2026-03-27 07:39:35.47533
7	2	13	t	\N	\N	2026-03-27 09:56:30.362834
\.


--
-- Data for Name: inspections; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.inspections (id, schedule_id, supervisor_id, plant_id, template_id, inspected_at, created_at) FROM stdin;
1	5	1	1	1	2026-03-27	2026-03-27 07:39:35.469454
2	9	1	1	4	2026-03-27	2026-03-27 09:56:30.325472
\.


--
-- Data for Name: plants; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.plants (id, name, code, description, created_at) FROM stdin;
1	Hot End	HOT	Hot End Production Area	2026-03-26 06:51:36.297127
2	Cold End	COLD	Cold End Production Area	2026-03-26 06:51:36.297127
\.


--
-- Data for Name: questions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.questions (id, template_id, text, answer_type, is_mandatory, requires_photo, category_id, order_index, created_at, expected_answer) FROM stdin;
2	1	Area kerja bebas dari benda berbahaya yang berserakan?	yes_no	t	t	1	2	2026-03-26 06:52:33.832803	\N
3	1	APAR (Alat Pemadam Api Ringan) dalam kondisi baik dan mudah dijangkau?	yes_no	t	f	1	3	2026-03-26 06:52:33.832803	\N
4	1	Rambu-rambu keselamatan terpasang dengan jelas?	yes_no	f	f	1	4	2026-03-26 06:52:33.832803	\N
5	1	Limbah B3 dibuang sesuai prosedur?	yes_no	t	t	2	5	2026-03-26 06:52:33.832803	\N
6	1	Catatan temuan tambahan:	text	f	f	1	6	2026-03-26 06:52:33.832803	\N
7	2	Drainase lingkungan berfungsi dengan baik?	yes_no	t	f	2	1	2026-03-26 06:52:33.832803	\N
8	2	Tidak ada tumpahan bahan kimia di area?	yes_no	t	t	2	2	2026-03-26 06:52:33.832803	\N
9	2	Pengelolaan sampah sesuai SOP?	yes_no	t	f	2	3	2026-03-26 06:52:33.832803	\N
10	3	Mesin beroperasi dalam kondisi normal?	yes_no	t	f	1	1	2026-03-26 06:52:33.832803	\N
11	3	Pelumas mesin dalam level yang memadai?	yes_no	t	f	1	2	2026-03-26 06:52:33.832803	\N
12	3	Tombol emergency stop berfungsi?	yes_no	t	f	1	3	2026-03-26 06:52:33.832803	\N
1	1	APD (Alat Pelindung Diri) tersedia dan digunakan dengan benar?	yes_no	t	f	1	1	2026-03-26 06:52:33.832803	yes
13	4	Apakah ada Serangan Cyber?	yes_no	t	f	5	999	2026-03-27 09:52:36.60942	no
\.


--
-- Data for Name: schedule_groups; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.schedule_groups (id, schedule_id, group_id) FROM stdin;
1	9	6
\.


--
-- Data for Name: schedule_users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.schedule_users (id, schedule_id, user_id) FROM stdin;
\.


--
-- Data for Name: schedules; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.schedules (id, supervisor_id, template_id, plant_id, week_start, week_end, status, created_at, group_id, frequency, day_of_week, day_of_month, custom_days, is_active, title) FROM stdin;
1	2	1	1	2026-03-23	2026-03-29	pending	2026-03-26 06:52:33.832803	\N	weekly	\N	\N	\N	1	\N
2	2	2	2	2026-03-16	2026-03-22	completed	2026-03-26 06:52:33.832803	\N	weekly	\N	\N	\N	1	\N
3	3	3	1	2026-03-01	2026-03-31	pending	2026-03-26 06:52:33.832803	\N	weekly	\N	\N	\N	1	\N
4	2	1	1	2026-03-23	2026-03-29	completed	2026-03-26 06:52:33.832803	\N	weekly	\N	\N	\N	1	\N
6	\N	2	2	2026-03-24	2026-03-30	active	2026-03-27 06:45:32.789869	2	weekly	1	\N	\N	1	\N
7	\N	3	1	2026-03-01	2026-03-31	active	2026-03-27 06:45:32.789869	3	monthly	\N	\N	\N	1	\N
8	\N	1	2	2026-03-17	2026-03-23	pending	2026-03-27 06:45:32.789869	4	biweekly	3	\N	\N	1	\N
5	\N	1	1	2026-03-01	2026-03-31	completed	2026-03-27 06:45:32.789869	1	daily	\N	\N	\N	1	\N
9	\N	4	1	\N	\N	completed	2026-03-27 09:53:27.764037	6	weekly	1	\N	\N	1	IT Weekly
\.


--
-- Data for Name: smtp_settings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.smtp_settings (id, host, port, protocol, username, password, from_name, from_email, updated_at) FROM stdin;
\.


--
-- Data for Name: templates; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.templates (id, name, description, created_at) FROM stdin;
1	Weekly Safety Inspection	Template inspeksi keselamatan mingguan	2026-03-26 06:51:36.297127
2	Environmental Check	Pemeriksaan lingkungan rutin	2026-03-26 06:51:36.297127
3	Equipment Inspection	Inspeksi peralatan produksi	2026-03-26 06:51:36.297127
4	IT CyberSecurity	\N	2026-03-27 09:52:21.41891
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, nik, name, email, password_hash, role, department_id, is_head, created_at) FROM stdin;
1	ADM001	Admin HSE	admin@hse.com	3cbab4adccb27a27e042a21bc0013990cdf17afcfb93c83a74aa1ddc06cbee86	admin	1	t	2026-03-26 06:52:33.832803
2	SUP001	Budi Supervisor	budi@hse.com	24910895e7aac2c3afe580c0555bc37bff4e57abe743cc28d5e22894b64140ce	supervisor	2	f	2026-03-26 06:52:33.832803
3	SUP002	Dewi Supervisor	dewi@hse.com	24910895e7aac2c3afe580c0555bc37bff4e57abe743cc28d5e22894b64140ce	supervisor	3	f	2026-03-26 06:52:33.832803
4	EMP001	Andi Karyawan	andi@hse.com	24910895e7aac2c3afe580c0555bc37bff4e57abe743cc28d5e22894b64140ce	employee	2	f	2026-03-26 06:52:33.832803
5	EMP002	Sari Karyawan	sari@hse.com	24910895e7aac2c3afe580c0555bc37bff4e57abe743cc28d5e22894b64140ce	employee	4	f	2026-03-26 06:52:33.832803
\.


--
-- Name: actions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.actions_id_seq', 6, true);


--
-- Name: categories_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.categories_id_seq', 5, true);


--
-- Name: departments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.departments_id_seq', 4, true);


--
-- Name: group_members_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.group_members_id_seq', 7, true);


--
-- Name: groups_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.groups_id_seq', 6, true);


--
-- Name: incidents_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.incidents_id_seq', 26, true);


--
-- Name: inspection_answers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.inspection_answers_id_seq', 7, true);


--
-- Name: inspections_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.inspections_id_seq', 2, true);


--
-- Name: plants_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.plants_id_seq', 2, true);


--
-- Name: questions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.questions_id_seq', 13, true);


--
-- Name: schedule_groups_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.schedule_groups_id_seq', 1, true);


--
-- Name: schedule_users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.schedule_users_id_seq', 1, false);


--
-- Name: schedules_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.schedules_id_seq', 9, true);


--
-- Name: smtp_settings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.smtp_settings_id_seq', 1, false);


--
-- Name: templates_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.templates_id_seq', 4, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.users_id_seq', 5, true);


--
-- Name: actions actions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.actions
    ADD CONSTRAINT actions_pkey PRIMARY KEY (id);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: departments departments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_pkey PRIMARY KEY (id);


--
-- Name: group_members group_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_members
    ADD CONSTRAINT group_members_pkey PRIMARY KEY (id);


--
-- Name: groups groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.groups
    ADD CONSTRAINT groups_pkey PRIMARY KEY (id);


--
-- Name: incidents incidents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incidents
    ADD CONSTRAINT incidents_pkey PRIMARY KEY (id);


--
-- Name: inspection_answers inspection_answers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inspection_answers
    ADD CONSTRAINT inspection_answers_pkey PRIMARY KEY (id);


--
-- Name: inspections inspections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inspections
    ADD CONSTRAINT inspections_pkey PRIMARY KEY (id);


--
-- Name: plants plants_code_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plants
    ADD CONSTRAINT plants_code_unique UNIQUE (code);


--
-- Name: plants plants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plants
    ADD CONSTRAINT plants_pkey PRIMARY KEY (id);


--
-- Name: questions questions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.questions
    ADD CONSTRAINT questions_pkey PRIMARY KEY (id);


--
-- Name: schedule_groups schedule_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_groups
    ADD CONSTRAINT schedule_groups_pkey PRIMARY KEY (id);


--
-- Name: schedule_users schedule_users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_users
    ADD CONSTRAINT schedule_users_pkey PRIMARY KEY (id);


--
-- Name: schedules schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedules
    ADD CONSTRAINT schedules_pkey PRIMARY KEY (id);


--
-- Name: smtp_settings smtp_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.smtp_settings
    ADD CONSTRAINT smtp_settings_pkey PRIMARY KEY (id);


--
-- Name: templates templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.templates
    ADD CONSTRAINT templates_pkey PRIMARY KEY (id);


--
-- Name: users users_email_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_unique UNIQUE (email);


--
-- Name: users users_nik_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_nik_unique UNIQUE (nik);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: categories categories_pic_group_id_groups_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pic_group_id_groups_id_fk FOREIGN KEY (pic_group_id) REFERENCES public.groups(id);


--
-- Name: group_members group_members_group_id_groups_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_members
    ADD CONSTRAINT group_members_group_id_groups_id_fk FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE;


--
-- Name: group_members group_members_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_members
    ADD CONSTRAINT group_members_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: incidents incidents_action_id_actions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incidents
    ADD CONSTRAINT incidents_action_id_actions_id_fk FOREIGN KEY (action_id) REFERENCES public.actions(id);


--
-- Name: incidents incidents_assigned_group_id_groups_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incidents
    ADD CONSTRAINT incidents_assigned_group_id_groups_id_fk FOREIGN KEY (assigned_group_id) REFERENCES public.groups(id);


--
-- Name: incidents incidents_category_id_categories_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incidents
    ADD CONSTRAINT incidents_category_id_categories_id_fk FOREIGN KEY (category_id) REFERENCES public.categories(id);


--
-- Name: incidents incidents_plant_id_plants_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incidents
    ADD CONSTRAINT incidents_plant_id_plants_id_fk FOREIGN KEY (plant_id) REFERENCES public.plants(id);


--
-- Name: incidents incidents_reporter_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incidents
    ADD CONSTRAINT incidents_reporter_id_users_id_fk FOREIGN KEY (reporter_id) REFERENCES public.users(id);


--
-- Name: inspection_answers inspection_answers_inspection_id_inspections_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inspection_answers
    ADD CONSTRAINT inspection_answers_inspection_id_inspections_id_fk FOREIGN KEY (inspection_id) REFERENCES public.inspections(id) ON DELETE CASCADE;


--
-- Name: inspection_answers inspection_answers_question_id_questions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inspection_answers
    ADD CONSTRAINT inspection_answers_question_id_questions_id_fk FOREIGN KEY (question_id) REFERENCES public.questions(id);


--
-- Name: inspections inspections_plant_id_plants_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inspections
    ADD CONSTRAINT inspections_plant_id_plants_id_fk FOREIGN KEY (plant_id) REFERENCES public.plants(id);


--
-- Name: inspections inspections_schedule_id_schedules_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inspections
    ADD CONSTRAINT inspections_schedule_id_schedules_id_fk FOREIGN KEY (schedule_id) REFERENCES public.schedules(id);


--
-- Name: inspections inspections_supervisor_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inspections
    ADD CONSTRAINT inspections_supervisor_id_users_id_fk FOREIGN KEY (supervisor_id) REFERENCES public.users(id);


--
-- Name: inspections inspections_template_id_templates_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inspections
    ADD CONSTRAINT inspections_template_id_templates_id_fk FOREIGN KEY (template_id) REFERENCES public.templates(id);


--
-- Name: questions questions_category_id_categories_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.questions
    ADD CONSTRAINT questions_category_id_categories_id_fk FOREIGN KEY (category_id) REFERENCES public.categories(id);


--
-- Name: questions questions_template_id_templates_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.questions
    ADD CONSTRAINT questions_template_id_templates_id_fk FOREIGN KEY (template_id) REFERENCES public.templates(id) ON DELETE CASCADE;


--
-- Name: schedule_groups schedule_groups_group_id_groups_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_groups
    ADD CONSTRAINT schedule_groups_group_id_groups_id_fk FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE;


--
-- Name: schedule_groups schedule_groups_schedule_id_schedules_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_groups
    ADD CONSTRAINT schedule_groups_schedule_id_schedules_id_fk FOREIGN KEY (schedule_id) REFERENCES public.schedules(id) ON DELETE CASCADE;


--
-- Name: schedule_users schedule_users_schedule_id_schedules_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_users
    ADD CONSTRAINT schedule_users_schedule_id_schedules_id_fk FOREIGN KEY (schedule_id) REFERENCES public.schedules(id) ON DELETE CASCADE;


--
-- Name: schedule_users schedule_users_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_users
    ADD CONSTRAINT schedule_users_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: schedules schedules_group_id_groups_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedules
    ADD CONSTRAINT schedules_group_id_groups_id_fk FOREIGN KEY (group_id) REFERENCES public.groups(id);


--
-- Name: schedules schedules_plant_id_plants_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedules
    ADD CONSTRAINT schedules_plant_id_plants_id_fk FOREIGN KEY (plant_id) REFERENCES public.plants(id);


--
-- Name: schedules schedules_supervisor_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedules
    ADD CONSTRAINT schedules_supervisor_id_users_id_fk FOREIGN KEY (supervisor_id) REFERENCES public.users(id);


--
-- Name: schedules schedules_template_id_templates_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedules
    ADD CONSTRAINT schedules_template_id_templates_id_fk FOREIGN KEY (template_id) REFERENCES public.templates(id);


--
-- Name: users users_department_id_departments_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_department_id_departments_id_fk FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- PostgreSQL database dump complete
--

\unrestrict 96GAMuqTv3cPRzmVTnMKbCyHi7qyub65IMSJacVwX1t5CqnuFwN1vcxMoxavseu

