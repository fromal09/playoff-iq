// Full name map (modern + historical)
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
  // Defunct
  AND:'Anderson Packers', CHS:'Chicago Stags', CLR:'Cleveland Rebels',
  INO:'Indianapolis Olympians', SHE:'Sheboygan Redskins',
  STB:'St. Louis Bombers', BLB:'Baltimore Bullets (orig.)',
}

// All historical abbrevs that roll up to a modern franchise
// Used for display in dropdowns and franchise filtering
export const FRANCHISE_ROLLUP: Record<string, string> = {
  // Modern abbrevs map to themselves
  ATL:'ATL',BOS:'BOS',BRK:'BRK',CHO:'CHO',CHI:'CHI',CLE:'CLE',
  DAL:'DAL',DEN:'DEN',DET:'DET',GSW:'GSW',HOU:'HOU',IND:'IND',
  LAC:'LAC',LAL:'LAL',MEM:'MEM',MIA:'MIA',MIL:'MIL',MIN:'MIN',
  NOP:'NOP',NYK:'NYK',OKC:'OKC',ORL:'ORL',PHI:'PHI',PHO:'PHO',
  POR:'POR',SAC:'SAC',SAS:'SAS',TOR:'TOR',UTA:'UTA',WAS:'WAS',
  // Historical → modern
  STL:'ATL',TRI:'ATL',          // Hawks
  NJN:'BRK',                    // Nets
  CHA:'CHO',CHH:'CHO',          // Hornets
  FTW:'DET',                    // Pistons
  SFW:'GSW',PHW:'GSW',          // Warriors
  SDR:'HOU',                    // Rockets
  BUF:'LAC',                    // Clippers
  MNL:'LAL',                    // Lakers
  NOH:'NOP',                    // Pelicans
  SEA:'OKC',                    // Thunder
  SYR:'PHI',                    // 76ers
  KCK:'SAC',KCO:'SAC',CIN:'SAC',ROC:'SAC', // Kings
  WSB:'WAS',CAP:'WAS',BAL:'WAS',WSC:'WAS', // Wizards
  // Defunct — map to themselves
  AND:'AND',CHS:'CHS',CLR:'CLR',INO:'INO',SHE:'SHE',STB:'STB',BLB:'BLB',
}

const DEFUNCT = new Set(['AND','CHS','CLR','INO','SHE','STB','BLB'])

// 30 current franchises sorted alphabetically
export const ACTIVE_FRANCHISES = [
  {abbr:'ATL',name:'Atlanta Hawks'},
  {abbr:'BOS',name:'Boston Celtics'},
  {abbr:'BRK',name:'Brooklyn Nets'},
  {abbr:'CHO',name:'Charlotte Hornets'},
  {abbr:'CHI',name:'Chicago Bulls'},
  {abbr:'CLE',name:'Cleveland Cavaliers'},
  {abbr:'DAL',name:'Dallas Mavericks'},
  {abbr:'DEN',name:'Denver Nuggets'},
  {abbr:'DET',name:'Detroit Pistons'},
  {abbr:'GSW',name:'Golden State Warriors'},
  {abbr:'HOU',name:'Houston Rockets'},
  {abbr:'IND',name:'Indiana Pacers'},
  {abbr:'LAC',name:'LA Clippers'},
  {abbr:'LAL',name:'Los Angeles Lakers'},
  {abbr:'MEM',name:'Memphis Grizzlies'},
  {abbr:'MIA',name:'Miami Heat'},
  {abbr:'MIL',name:'Milwaukee Bucks'},
  {abbr:'MIN',name:'Minnesota Timberwolves'},
  {abbr:'NOP',name:'New Orleans Pelicans'},
  {abbr:'NYK',name:'New York Knicks'},
  {abbr:'OKC',name:'Oklahoma City Thunder'},
  {abbr:'ORL',name:'Orlando Magic'},
  {abbr:'PHI',name:'Philadelphia 76ers'},
  {abbr:'PHO',name:'Phoenix Suns'},
  {abbr:'POR',name:'Portland Trail Blazers'},
  {abbr:'SAC',name:'Sacramento Kings'},
  {abbr:'SAS',name:'San Antonio Spurs'},
  {abbr:'TOR',name:'Toronto Raptors'},
  {abbr:'UTA',name:'Utah Jazz'},
  {abbr:'WAS',name:'Washington Wizards'},
]

export const DEFUNCT_FRANCHISES = [
  {abbr:'AND',name:'Anderson Packers'},
  {abbr:'BLB',name:'Baltimore Bullets (orig.)'},
  {abbr:'CHS',name:'Chicago Stags'},
  {abbr:'CLR',name:'Cleveland Rebels'},
  {abbr:'INO',name:'Indianapolis Olympians'},
  {abbr:'SHE',name:'Sheboygan Redskins'},
  {abbr:'STB',name:'St. Louis Bombers'},
]

// Legacy export — kept for compatibility with existing pages
export const ALL_FRANCHISES = [
  ...ACTIVE_FRANCHISES,
  ...DEFUNCT_FRANCHISES,
]

export const ROUND_NAMES: Record<number, string> = {
  1:'First Round', 2:'Second Round', 3:'Conf. Finals', 4:'NBA Finals',
}

export const ERA_LABELS: Record<string, string> = {
  modern:'1980–present', mid:'1974–1979', pre74:'Pre-1974',
}
