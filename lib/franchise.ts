// Modern franchise names (current branding)
export const FRANCHISE_NAMES: Record<string, string> = {
  ATL:'Atlanta Hawks', BOS:'Boston Celtics', BRK:'Brooklyn Nets',
  CHO:'Charlotte Hornets', CHI:'Chicago Bulls', CLE:'Cleveland Cavaliers',
  DAL:'Dallas Mavericks', DEN:'Denver Nuggets', DET:'Detroit Pistons',
  GSW:'Golden State Warriors', HOU:'Houston Rockets', IND:'Indiana Pacers',
  LAC:'LA Clippers', LAL:'Los Angeles Lakers', MEM:'Memphis Grizzlies',
  MIA:'Miami Heat', MIL:'Milwaukee Bucks', MIN:'Minnesota Timberwolves',
  NOP:'New Orleans Pelicans', NYK:'New York Knicks', OKC:'Oklahoma City Thunder',
  ORL:'Orlando Magic', PHI:'Philadelphia 76ers', PHO:'Phoenix Suns',
  POR:'Portland Trail Blazers', SAC:'Sacramento Kings', SAS:'San Antonio Spurs',
  TOR:'Toronto Raptors', UTA:'Utah Jazz', WAS:'Washington Wizards',
  AND:'Anderson Packers', CHS:'Chicago Stags', CLR:'Cleveland Rebels',
  INO:'Indianapolis Olympians', SHE:'Sheboygan Redskins',
  STB:'St. Louis Bombers', BLB:'Baltimore Bullets (orig.)',
}

// Historical team names — what the team was actually called at the time
export const HISTORICAL_TEAM_NAMES: Record<string, string> = {
  // Atlanta Hawks lineage
  ATL:'Atlanta Hawks', STL:'St. Louis Hawks', TRI:'Tri-Cities Blackhawks',
  // Boston Celtics
  BOS:'Boston Celtics',
  // Brooklyn / New Jersey Nets
  BRK:'Brooklyn Nets', NJN:'New Jersey Nets',
  // Charlotte
  CHO:'Charlotte Hornets', CHA:'Charlotte Bobcats', CHH:'Charlotte Hornets',
  // Chicago Bulls
  CHI:'Chicago Bulls',
  // Cleveland Cavaliers
  CLE:'Cleveland Cavaliers',
  // Dallas Mavericks
  DAL:'Dallas Mavericks',
  // Denver Nuggets
  DEN:'Denver Nuggets',
  // Detroit / Fort Wayne
  DET:'Detroit Pistons', FTW:'Fort Wayne Pistons',
  // Golden State / San Francisco / Philadelphia Warriors
  GSW:'Golden State Warriors', SFW:'San Francisco Warriors', PHW:'Philadelphia Warriors',
  // Houston / San Diego Rockets
  HOU:'Houston Rockets', SDR:'San Diego Rockets',
  // Indiana Pacers
  IND:'Indiana Pacers',
  // LA Clippers / Buffalo Braves
  LAC:'Los Angeles Clippers', BUF:'Buffalo Braves',
  // LA Lakers / Minneapolis
  LAL:'Los Angeles Lakers', MNL:'Minneapolis Lakers',
  // Memphis Grizzlies
  MEM:'Memphis Grizzlies',
  // Miami Heat
  MIA:'Miami Heat',
  // Milwaukee Bucks
  MIL:'Milwaukee Bucks',
  // Minnesota Timberwolves
  MIN:'Minnesota Timberwolves',
  // New Orleans — NOH = Hornets, NOP = Pelicans
  NOP:'New Orleans Pelicans', NOH:'New Orleans Hornets',
  // New York Knicks
  NYK:'New York Knicks',
  // Oklahoma City / Seattle
  OKC:'Oklahoma City Thunder', SEA:'Seattle SuperSonics',
  // Orlando Magic
  ORL:'Orlando Magic',
  // Philadelphia 76ers / Syracuse Nationals
  PHI:'Philadelphia 76ers', SYR:'Syracuse Nationals',
  // Phoenix Suns
  PHO:'Phoenix Suns',
  // Portland Trail Blazers
  POR:'Portland Trail Blazers',
  // Sacramento Kings lineage
  SAC:'Sacramento Kings', KCK:'Kansas City Kings',
  KCO:'Kansas City-Omaha Kings', CIN:'Cincinnati Royals', ROC:'Rochester Royals',
  // San Antonio Spurs
  SAS:'San Antonio Spurs',
  // Toronto Raptors
  TOR:'Toronto Raptors',
  // Utah Jazz
  UTA:'Utah Jazz',
  // Washington lineage
  WAS:'Washington Wizards', WSB:'Washington Bullets',
  CAP:'Capital Bullets', BAL:'Baltimore Bullets', WSC:'Washington Capitols',
  // Defunct
  AND:'Anderson Packers', CHS:'Chicago Stags', CLR:'Cleveland Rebels',
  INO:'Indianapolis Olympians', SHE:'Sheboygan Redskins',
  STB:'St. Louis Bombers', BLB:'Baltimore Bullets',
}

// Maps any historical abbrev to the modern franchise abbrev
export const FRANCHISE_ROLLUP: Record<string, string> = {
  ATL:'ATL',STL:'ATL',TRI:'ATL',
  BOS:'BOS', BRK:'BRK',NJN:'BRK',
  CHO:'CHO',CHA:'CHO',CHH:'CHO',
  CHI:'CHI', CLE:'CLE', DAL:'DAL', DEN:'DEN',
  DET:'DET',FTW:'DET',
  GSW:'GSW',SFW:'GSW',PHW:'GSW',
  HOU:'HOU',SDR:'HOU',
  IND:'IND', LAC:'LAC',BUF:'LAC',
  LAL:'LAL',MNL:'LAL',
  MEM:'MEM', MIA:'MIA', MIL:'MIL', MIN:'MIN',
  NOP:'NOP',NOH:'NOP',
  NYK:'NYK', OKC:'OKC',SEA:'OKC',
  ORL:'ORL', PHI:'PHI',SYR:'PHI',
  PHO:'PHO', POR:'POR',
  SAC:'SAC',KCK:'SAC',KCO:'SAC',CIN:'SAC',ROC:'SAC',
  SAS:'SAS', TOR:'TOR', UTA:'UTA',
  WAS:'WAS',WSB:'WAS',CAP:'WAS',BAL:'WAS',WSC:'WAS',
  AND:'AND',CHS:'CHS',CLR:'CLR',INO:'INO',SHE:'SHE',STB:'STB',BLB:'BLB',
}

export const ACTIVE_FRANCHISES = [
  {abbr:'ATL',name:'Atlanta Hawks'}, {abbr:'BOS',name:'Boston Celtics'},
  {abbr:'BRK',name:'Brooklyn Nets'}, {abbr:'CHO',name:'Charlotte Hornets'},
  {abbr:'CHI',name:'Chicago Bulls'}, {abbr:'CLE',name:'Cleveland Cavaliers'},
  {abbr:'DAL',name:'Dallas Mavericks'}, {abbr:'DEN',name:'Denver Nuggets'},
  {abbr:'DET',name:'Detroit Pistons'}, {abbr:'GSW',name:'Golden State Warriors'},
  {abbr:'HOU',name:'Houston Rockets'}, {abbr:'IND',name:'Indiana Pacers'},
  {abbr:'LAC',name:'LA Clippers'}, {abbr:'LAL',name:'Los Angeles Lakers'},
  {abbr:'MEM',name:'Memphis Grizzlies'}, {abbr:'MIA',name:'Miami Heat'},
  {abbr:'MIL',name:'Milwaukee Bucks'}, {abbr:'MIN',name:'Minnesota Timberwolves'},
  {abbr:'NOP',name:'New Orleans Pelicans'}, {abbr:'NYK',name:'New York Knicks'},
  {abbr:'OKC',name:'Oklahoma City Thunder'}, {abbr:'ORL',name:'Orlando Magic'},
  {abbr:'PHI',name:'Philadelphia 76ers'}, {abbr:'PHO',name:'Phoenix Suns'},
  {abbr:'POR',name:'Portland Trail Blazers'}, {abbr:'SAC',name:'Sacramento Kings'},
  {abbr:'SAS',name:'San Antonio Spurs'}, {abbr:'TOR',name:'Toronto Raptors'},
  {abbr:'UTA',name:'Utah Jazz'}, {abbr:'WAS',name:'Washington Wizards'},
]

export const DEFUNCT_FRANCHISES = [
  {abbr:'AND',name:'Anderson Packers'}, {abbr:'BLB',name:'Baltimore Bullets (orig.)'},
  {abbr:'CHS',name:'Chicago Stags'}, {abbr:'CLR',name:'Cleveland Rebels'},
  {abbr:'INO',name:'Indianapolis Olympians'}, {abbr:'SHE',name:'Sheboygan Redskins'},
  {abbr:'STB',name:'St. Louis Bombers'},
]

export const ALL_FRANCHISES = [...ACTIVE_FRANCHISES, ...DEFUNCT_FRANCHISES]

export const ROUND_NAMES: Record<number, string> = {
  1:'First Round', 2:'Second Round', 3:'Conf. Finals', 4:'NBA Finals',
}

export const ERA_LABELS: Record<string, string> = {
  modern:'1980–present', mid:'1974–1979', pre74:'Pre-1974',
}
