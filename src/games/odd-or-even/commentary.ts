/**
 * Commentary lines for ODD or EVEN, carried over from the original
 * Commentary.py written for the hand-cricket prototype this game is based
 * on. Grouped by outcome so the engine can pull a random, relevant line
 * for whatever just happened on the pitch.
 */

export type ShotKind = "hook" | "cut" | "coverDrive" | "straightDrive" | "pull" | "sweep";

export const SHOT_LABELS: Record<ShotKind, string> = {
  hook: "Hook",
  cut: "Cut Shot",
  coverDrive: "Cover Drive",
  straightDrive: "Straight Drive",
  pull: "Pull Shot",
  sweep: "Sweep",
};

export const SHOT_ORDER: ShotKind[] = ["hook", "cut", "coverDrive", "straightDrive", "pull", "sweep"];

/**
 * Deliveries a bowler can choose from. Kept as a separate, equal-length
 * enum from ShotKind so the UI can show bowling-appropriate choices when
 * the player is bowling, while the engine still matches shot-vs-delivery
 * by index (mirrors the original odds).
 */
export type DeliveryKind = "yorker" | "bouncer" | "googly" | "inswinger" | "slowerBall" | "offCutter";

export const DELIVERY_LABELS: Record<DeliveryKind, string> = {
  yorker: "Yorker",
  bouncer: "Bouncer",
  googly: "Googly",
  inswinger: "Inswinger",
  slowerBall: "Slower Ball",
  offCutter: "Off Cutter",
};

export const DELIVERY_ORDER: DeliveryKind[] = [
  "yorker",
  "bouncer",
  "googly",
  "inswinger",
  "slowerBall",
  "offCutter",
];

function pick(lines: string[]): string {
  return lines[Math.floor(Math.random() * lines.length)];
}

const BOWLED_OUT_LINES: Record<DeliveryKind, string[]> = {
  yorker: [
    "A nailed yorker! Dead on the base of off-stump — the batsman had no room to dig it out, and the stumps are in pieces.",
    "Toe-crushing yorker! It's full, it's fast, and it's absolutely unplayable. The batsman jams his bat down a fraction too late and the off-stump cartwheels away.",
    "That's a searing yorker right into the blockhole! The batsman couldn't get his bat down in time, and the stumps have been rearranged.",
    "Unplayable! A perfect yorker, full and fast, sneaks in under the bat and crashes into leg stump.",
    "Right on the money! The yorker is aimed at the base of the stumps, the batsman is deceived by the pace, and the timber is shattered.",
  ],
  bouncer: [
    "Express pace, that one clocked well past 150kph! The batsman simply couldn't get his eyes in line, ducked into it, and the ball crashes onto the stumps.",
    "Sheer speed does the damage! A vicious bouncer rearing up at 150kph — the batsman completely misjudges the bounce and is struck plumb through to the stumps.",
    "That's raw pace! The bouncer skids through quicker than expected, the batsman is a fraction late on the pull, and the ball cannons into off-stump.",
    "Blistering pace! The batsman is rushed by the extra bounce, gets into an ugly tangle, and the ball loops back to knock the stumps.",
    "That's fearsome bowling! The bouncer is short and searingly quick, the batsman ducks straight into it, and the bails are gone.",
  ],
  googly: [
    "Beautifully disguised googly! The batsman reads it as the stock ball, plays down the wrong line entirely, and the ball sneaks through the gate to flatten the stumps.",
    "What deception! The googly turns the other way, the batsman is completely foxed, and off-stump is sent cartwheeling.",
    "Classic wrong'un! The batsman has no clue which way it's spinning, offers no shot, and the ball spins in sharply to clip the top of off-stump.",
    "Superbly disguised! The googly drifts in, dips, and turns past a groping bat to rattle the stumps.",
    "The batsman is done in by the flight and the turn — a perfect googly sneaks through the gate and knocks middle stump back.",
  ],
  inswinger: [
    "Beautiful inswinger! It shapes back in late, beats the inside edge, and crashes into the pads and stumps in one motion.",
    "That's late, lethal swing! The ball nips back in from a good length, the batsman is squared up, and the stumps go flying.",
    "The inswinger holds its line then darts back in at the last moment — the batsman plays outside the line and is bowled all ends up.",
    "Beaten for swing! The inswinger curves in late, the bat comes down outside the line, and the stumps are rattled.",
    "That's a jaffa! Full and swinging in from outside off, it beats the drive completely and cannons into the stumps.",
  ],
  slowerBall: [
    "Deceived completely by the change of pace! The batsman is through his shot far too early, and the slower ball trickles on to clip the stumps.",
    "What a clever slower ball! The batsman commits early, the bat comes down well ahead of the ball, and off-stump is knocked back.",
    "The slower ball does the trick — the batsman has no answer to the change in pace, drags his feet, and the stumps are shattered.",
    "Beautifully disguised change of pace! The batsman is miles early into his shot, and the ball lobs on gently to disturb the stumps.",
    "Slower through the air than expected — the batsman is completely deceived, swings early, and is bowled comprehensively.",
  ],
  offCutter: [
    "A wicked off-cutter grips and darts back sharply off the surface — the batsman is beaten for pace and the stumps are rattled.",
    "That off-cutter holds its line and cuts back in off the seam, sneaking through bat and pad to castle the stumps.",
    "Superb variation! The off-cutter slows on the batsman and turns back in, beating a hurried defensive prod to knock the stumps over.",
    "Cleverly bowled! The off-cutter grips off the surface and jags back in, beating the outside edge to hit the stumps.",
    "That's a beauty! The off-cutter deceives the batsman in the air and off the pitch, and the stumps are disturbed.",
  ],
};

const SIX_LINES: Record<ShotKind, string[]> = {
  hook: [
    "What a shot! The batsman picked the length early, swiveled on his back foot, and unleashed a thunderous hook shot. The ball soared high into the air, and it's gone all the way! Six runs! That was pure power and perfect timing.",
    "Incredible batting display! The bowler thought he had the upper hand with the short-pitched delivery, but the batsman was up to the challenge. A lightning-quick pivot, a resounding crack of the bat, and the ball sails over the boundary for a maximum. That's the hook shot at its best!",
    "Talk about audacity! The short ball was coming in at serious pace, but the batsman was equal to the task. He rocked back, unleashed the hook shot, and the ball disappears into the crowd. Six runs! The crowd is on its feet, and that shot will be etched in everyone's memory.",
    "Absolutely obliterated! The bowler drops it short looking for a reaction, and the batsman gives him exactly that — a ferocious hook that clears the ropes with ease.",
    "That's a monstrous hit! The batsman gets right underneath the hook, and the ball disappears into the night sky. The bowler just shakes his head.",
  ],
  cut: [
    "Oh, what a magnificent cut shot! The batsman opened up the face of the bat and slashed it through the off-side. The ball raced away to the boundary, and it's gone all the way! A perfectly timed cut shot for a delightful six.",
    "Vintage batting on display here! The batsman rocked back onto the back foot, played the perfect cut shot, and sent the ball soaring into the stands. The fielders could only watch as it cleared the ropes effortlessly.",
    "That's the class of a top-order batsman! The cut shot executed with such finesse, the ball seemed to have a GPS to find the gap in the field and sail over the boundary. A picturesque six, and the crowd erupts in appreciation.",
    "Ferocious! The batsman goes hard at a wide one, and the cut shot flies off the middle of the bat, over point, and into the stands for six.",
    "That's brutal! A short and wide delivery gets carved away with a cut shot of pure violence, and it sails miles over the boundary.",
  ],
  coverDrive: [
    "Oh, that's a shot of sheer elegance! The batsman leans into the cover drive, timing it to perfection. The ball races to the boundary, and it's a glorious sight as it clears the ropes for a maximum. Classic cricketing grace on display!",
    "What a way to bring up the fifty! The batsman showcasing textbook technique with a sublime cover drive. The ball races through the gap, and it's a maximum! The fielders can only watch as the ball sails over the boundary. A shot that's pure poetry in motion!",
    "Talk about timing! The batsman effortlessly glides the ball through the covers, and it's gone all the way! That's not just a six; it's a statement. The crowd is on their feet, applauding a shot that exemplifies the beauty of the game. Simply magnificent!",
    "Sheer class! The cover drive is lofted with such control that it sails over extra cover and into the stands without ever looking hurried.",
    "That's a shot from the top drawer! The batsman leans in, times a lofted cover drive to perfection, and the ball is gone before the fielder can even move.",
  ],
  straightDrive: [
    "That's pure elegance from the batsman! The straight drive was so perfectly executed; it's as if the bat was a conductor's wand, directing the ball straight down the ground and into the stands for a maximum. What a shot!",
    "This is cricketing poetry in motion! The batsman has just unfurled a majestic straight drive. The timing, the placement, everything about that shot was spot-on. The bowler had no chance, and the ball sails away for a magnificent six.",
    "Crack! The sound of the ball meeting the bat was sweet, and the result is even sweeter. The batsman has dispatched that delivery with authority, sending it straight back over the bowler's head for a colossal six. What a way to assert dominance!",
    "Down the ground and gone! The batsman times the straight drive so cleanly that the bowler doesn't even have time to duck out of the way. Huge six!",
    "That's a statement of intent! The straight drive is launched with full extension, and the ball sails miles over the sight screen for a colossal maximum.",
  ],
  pull: [
    "Oh, what a magnificent pull shot! The batsman picked up the length early, rocked onto the back foot, and dispatched it into the stands with authority. That's a maximum, a towering six!",
    "Cracking shot! The short-pitched delivery was asking for trouble, and the batsman was up for the challenge. He swivels on the back foot, connects sweetly, and the ball sails over the boundary rope for a big six!",
    "Look at the power and timing in that pull shot! The bowler banged it in short, but the batsman was up to the task. He rocked back, unleashed the pull, and the ball is lost in the crowd. Six runs, and the crowd erupts!",
    "That's ferocious hitting! The pull shot is timed to perfection, and the ball rockets over mid-wicket and into the stands.",
    "Sensational! The batsman reads the short ball early, pulls it with brutal power, and it's gone all the way for a huge six.",
  ],
  sweep: [
    "What a daring sweep shot! The batsman read the line of the spinner beautifully, got down on one knee, and sent that ball soaring over the deep square leg boundary. That's not just a sweep; it's a statement!",
    "Unbelievable skill on display! The batsman used the sweep shot to perfection, picking the length early and dispatching it into the stands. The crowd erupts as the ball sails effortlessly for a maximum. A textbook sweep gone big!",
    "This is audacious cricket at its finest! The batsman took on the challenge, executed a powerful reverse sweep, and the ball disappears over the boundary. Six runs added to the scoreboard in the most stylish manner possible!",
    "That's a huge slog sweep! The batsman gets right down and across, and the ball is launched high over deep square leg for a maximum.",
    "What audacity! The batsman goes down on one knee early, sweeps with full power, and clears the ropes with plenty to spare.",
  ],
};

const FOUR_LINES: Record<ShotKind, string[]> = {
  hook: [
    "Oh, what a shot! The batsman picks up on the short-pitched delivery, swivels on the back foot, and dispatches it with authority. The ball races to the boundary like a tracer bullet. That's a textbook hook shot, and the fielders had no chance!",
    "He's taken on the challenge of the baller, and my goodness, he's executed it to perfection! The batsman rocks back, unleashes a thunderous hook shot, and the ball rockets to the boundary. The fielders can only watch as it sails over the rope.",
    "A daring move by the batsman, and it pays off in style! The short ball was begging to be hit, and the batsman obliges with a majestic hook shot. The timing is exquisite, and the ball races away to the fence. What a statement from the batsman!",
    "Good placement there! The hook shot keeps low and threads the gap at fine leg, racing away for a well-earned four.",
    "That's controlled aggression! The batsman rides the bounce, guides the hook shot fine, and picks up another boundary.",
  ],
  cut: [
    "What a magnificent cut shot! The batsman expertly rocks back onto his back foot, opens the face of the bat, and guides it through the gap. The ball races away to the boundary, and the fielders can only watch in awe.",
    "Textbook stuff from the batsman! He picked the length early, got onto the back foot, and unleashed a perfectly executed cut shot. The timing was exquisite, and the ball races away to the boundary like a tracer bullet.",
    "Oh, that's a shot of pure class! The batsman waited for the short and wide delivery, slashed hard with precision, and the ball races away square of the wicket for a delightful boundary. The fielders had no chance.",
    "Crisp and clean! The cut shot finds the gap between point and gully, and the ball races away for a well-timed boundary.",
    "That's a shot with real intent! The batsman cuts hard and square, beating the diving fielder to the fence.",
  ],
  coverDrive: [
    "What a delightful cover drive! The batsman leaned into the shot with perfect timing, the ball raced past the fielders, and the boundary fielder had no chance. Textbook cricket at its finest, and the crowd applauds the elegance on display.",
    "Oh, that's a glorious shot! The batsman showcasing his class with a beautifully executed cover drive. The ball pierces the gap, and with impeccable timing, it races to the fence. The fielders can only watch as it reaches the boundary in no time.",
    "Exquisite! The batsman showcasing his mastery with a sumptuous cover drive. The fielders are mere spectators as the ball caresses the turf on its way to the boundary. The crowd roars in appreciation for that picture-perfect shot.",
    "Copybook technique! The cover drive is played with a full stride and soft hands, and the ball races through extra cover for four.",
    "That's a shot from the manual! Elbow high, head over the ball, and the cover drive finds the gap to the fence with ease.",
  ],
  straightDrive: [
    "Oh, what a glorious shot! That straight drive was like a picture illustration. The bat came down straight as an arrow, meeting the ball perfectly. The fielders could only watch as it raced to the boundary for a classic four!",
    "Absolutely exquisite! The batsman showcasing a masterclass in the art of the straight drive. The ball left the middle of the bat with such elegance, piercing the field and finding the rope. A boundary that oozed class and timing.",
    "Talk about timing! The batsman just lent into that one and sent it straight down the ground. The bowler had no chance as it raced past like a tracer bullet, reaching the fence in a blink of an eye. Magnificent execution of the straight drive for a well-deserved four!",
    "Straight back past the bowler! The drive is timed so well that the bowler barely gets a glimpse of it on its way to the fence.",
    "That's silky smooth! The straight drive splits mid-on and mid-off perfectly, racing away for a classy boundary.",
  ],
  pull: [
    "What a shot! The batsman rocked back onto the back foot, picked the length early, and unleashed a powerful pull shot. The ball raced to the boundary like a bullet train. The fielders had no chance, and that's a glorious four!",
    "Oh, that's a majestic pull shot! The batsman saw the ball coming, swiveled on his back foot, and dispatched it to the mid-wicket boundary with authority. The timing was impeccable, and the result is a resounding four runs.",
    "Talk about control! The batsman pulled that short delivery with absolute precision. The ball rocketed off the middle of the bat, and the fielders could only watch as it sped to the boundary. That's a insane pull shot, and the crowd is loving it!",
    "Punched away with authority! The pull shot keeps along the ground and races to the fence through mid-wicket.",
    "That's a shot of real conviction! The batsman rolls his wrists on the pull, and the ball beats the fielder at square leg for four.",
  ],
  sweep: [
    "What a beautifully executed sweep shot! The batsman read the line of the ball perfectly, got down on one knee, and sent it racing to the square leg boundary. The timing was impeccable, and that's a delightful boundary.",
    "Vintage stuff from the batsman! He saw the length early, got into position swiftly, and dispatched it to the fine leg boundary with finesse. The fielders had no chance, and the crowd is enjoying it.",
    "That's a shot straight out of the coaching manual! The batsman went down on one knee and swept it fine. The placement was exquisite, beating the fielder at short fine leg. The ball races away, and the crowd is treated to a masterclass in the sweep shot.",
    "Neatly placed! The sweep finds the gap at backward square leg, and the ball scoots away to the fence.",
    "That's a well-judged sweep! Late and fine, it beats the fielder at short leg and races away for four.",
  ],
};

const CAUGHT_OUT_LINES: Record<ShotKind, string[]> = {
  hook: [
    "Beautifully snatched! The fielder swiftly intercepts the hook shot, displaying impeccable reflexes and trapping the ball effortlessly.",
    "Precision in the field! The hook shot is intercepted with finesse by the fielder, showcasing quick hands and a keen sense of anticipation.",
    "Caught in the web! The fielder snares the hook shot, making it look like a routine catch with exceptional fielding skills on full display.",
    "Straight into the hands of the fielder at deep square leg! The hook shot didn't have the legs to clear him, and the batsman trudges off.",
    "Miscued! The hook shot goes off the top edge, loops gently, and is gobbled up by a grateful fielder.",
  ],
  cut: [
    "A textbook cut shot met with exceptional fielding precision! The fielder's quick reflexes and agility shine as they effortlessly snatch the ball mid-air, denying any chance for the batsman to capitalize on that well-executed shot.",
    "A masterful cut shot finds an equally skilled opponent in the fielder. The athleticism displayed to catch that swift cut is commendable, turning a potential boundary into a showcase of defensive prowess",
    "The cut shot had the potential to race away to the boundary, but the fielder had other plans. A stunning interception mid-air showcases not just athleticism, but a strategic anticipation that puts a halt to the batsman's intentions.",
    "Straight to the man at backward point! The cut shot was well struck but picked out the fielder perfectly. Gone!",
    "That's a soft dismissal — the cut shot lacked conviction, and the fielder at gully snaffles a straightforward catch.",
  ],
  coverDrive: [
    "Fantastic reflexes from the fielder! The cover drive seemed destined for the boundary, but a lightning-quick catch turns the tables. Precision in the field at its finest!",
    "Caught at cover! A cover drive meets an exceptional fielding effort. The fielder's anticipation and quick hands make it look effortless. A key breakthrough for the bowling side!",
    "Oh, what a catch! The cover drive appeared picture-perfect, but the fielder had other plans. A stunning grab at cover denies the batsman a boundary. Fielding brilliance on display!",
    "Hit uppishly! The cover drive doesn't quite get the elevation needed, and mid-off makes no mistake with a comfortable catch.",
    "Well held! The batsman goes searching for the drive a touch early, and the leading edge loops straight to cover.",
  ],
  straightDrive: [
    "Caught at mid-off! A lofted straight drive, but the fielder was perfectly positioned to pluck it out of the air. That's a classic case of a well-executed shot finding an even better-placed fielder.",
    "WOW, A magnificent a catch! The straight drive looked destined for the boundary, but the fielder at cover had other plans. A stunning reflex catch, and the batsman is left shaking his head in disbelief.",
    "Straight down the ground, but straight into the hands of the fielder! A well-timed straight drive, but the fielder's anticipation and quick hands turn it into a wicket. Cricket can be so unforgiving at times.",
    "Skied it! The straight drive balloons up off the splice, and the bowler completes an easy caught-and-bowled.",
    "Well judged by the fielder at long-off! The straight drive had the distance but not the placement, and he settles under it comfortably.",
  ],
  pull: [
    "The fielder showcased exceptional precision in grabbing that pull shot. The ball seemed destined for the boundary, but their quick reflexes and accurate positioning led to a crucial catch, turning the game in their team's favor.",
    "That catch off the pull shot could be the turning point of the game. The fielder's commitment and composure under pressure were evident. A game-changing moment that highlights the impact of sharp fielding in cricket",
    "An exquisite pull shot attempted, but the fielder leapt like a panther to snatch it out of the air a stunning catch that turned a potential boundary into a moment of brilliance.",
    "Top-edged! The pull shot flies off the splice, and the fielder at fine leg calls for it and takes a safe catch.",
    "Straight to deep mid-wicket! The pull shot was well struck but found the fielder in the perfect spot.",
  ],
  sweep: [
    "Sweep attempt thwarted! The fielder's lightning-fast reflexes intercept the edged sweep, denying the batsman any chance to score.",
    "Edged and intercepted! The fielder makes a crucial intervention, grabbing the edged sweep with precision, showcasing exceptional fielding skills on the cricket field.",
    "A close call for the batsman as the edged sweep flies towards the fielder. However, exceptional fielding skills come to the rescue, turning a potential boundary into a spectacular catch.",
    "Top-edged sweep! It loops high into the air, and short fine leg settles underneath it for a simple catch.",
    "Miscued badly! The sweep doesn't connect cleanly, and it drops straight into the lap of the fielder at square leg.",
  ],
};

const RUN_LINES: Record<1 | 2 | 3, string[]> = {
  1: [
    "A quick single taken, and the batsman is off the mark with a cheeky run.",
    "The batsman nudges it to the leg side, sprints through for a single",
    "Just a gentle push into the covers, and the batsman picks up a single comfortably.",
    "A well-timed flick to mid-wicket, and the batsman scampers through for a single.",
    "The batsman plays it with soft hands, guides it to point, and grabs a single.",
    "A single off the pads as the batsman works it to square leg.",
    "The bowler bowls a wide delivery, and the batsman manages to get a single from it.",
    "A defensive shot into the off-side, and the batsman crosses for a quick single.",
    "Worked away into the gap, and an easy single is taken to rotate the strike.",
    "Nurdled behind square for one — nothing flashy, just smart cricket.",
  ],
  2: [
    "Quick double there, good running between the wickets.",
    "They sneaked in for a couple, smart running by the batsmen.",
    "A swift two runs, putting pressure on the fielding side.",
    "Batsman showing intent with a brisk double.",
    "Two on the board, the scoreboard ticking along.",
    "Well-judged two, keeping the scoreboard moving.",
    "Batsman quick off the mark, earns a brace.",
    "Two more to the total, steady accumulation.",
    "Good placement into the gap, and they turn the first run into a comfortable two.",
    "Excellent running there — a routine single turned into two with a hard second run.",
  ],
  3: [
    "Just a quick single there,NO a fumble in the deeps as the batsman rotates the strike for a third.",
    "A nudge into the leg side, they take off for a couple, and that's three on the board.",
    "Three runs off the edge, a bit streaky, but the batsman gets away with it.",
    "A well-timed shot through the covers, they hustle for three.",
    "Quick running between the wickets turns a solid shot into a triple.",
    "The batsman flicks it to fine leg and sprints for three, good running between the wickets.",
    "Three more to the total, just a gentle push into the gap and they scamper through.",
    "Innovation from the batsman, a deft touch guides the ball to third man for a triple.",
    "Excellent placement in the deep, and superb running turns it into a well-deserved three.",
    "A mis-field in the outfield lets them steal an extra run — three to the total.",
  ],
};

const RUN_OUT_LINES: Record<1 | 2 | 3, string[]> = {
  1: [
    "Mix-up! The batsman set off for a quick single, sent back too late, and a direct hit from the fielder catches him well short. Run out!",
    "Horrible mix-up between the wickets! There was never a single there, and the throw comes in flat and true to shatter the stumps. He's run out!",
    "Hesitation costs him dear! A moment's indecision on that single, and the fielder swoops in, one stump to aim at, and hits it dead centre. Run out!",
    "Slow out of the blocks! The fielder pounces on the ball, and a lightning-fast pickup and throw catches the batsman well short of his crease.",
    "Called for, sent back, and it's chaos in the middle! The single that never was ends in a direct hit and a needless run out.",
  ],
  2: [
    "Disaster while chasing the second run! The fielder chases it down in the deep, unleashes a rocket throw, and the batsman is well short of his ground. Run out!",
    "They pushed hard for the second, but a brilliant piece of fielding and a bullet throw catch the batsman miles out of his crease. Run out!",
    "Greedy running there — going for two when one was safer. The throw comes in on the money, and the batsman can't make his ground. Run out!",
    "Superb work in the field! Chased, gathered, and fired in on the bounce — the batsman is caught well short going for the second.",
    "A moment of miscommunication turns a comfortable two into a run out, as the throw beats a diving batsman to the crease.",
  ],
  3: [
    "Pushing hard for a third, but the fielder relays it in with interest, and the batsman dives but can't beat the throw. Run out!",
    "A stunning piece of fielding in the deep! The batsman was never going to make it back for the third, and the stumps are broken clean. Run out!",
    "Tired legs on that third run — the throw is collected and the bails are off before the batsman can complete his dive. Run out!",
    "Ambitious running for the third pays the price! A flat, direct throw from the deep beats the batsman to the crease.",
    "Brilliant relay fielding in the deep cuts the third run short — the bails are whipped off in a flash. Run out!",
  ],
};

const MILESTONE_LINES: string[] = [
  "{team} brings up {score}! The scoreboard keeps ticking along nicely.",
  "That's the {score} mark up for {team} — a solid platform is being built.",
  "{team} moves to {score}. Steady progress, and the innings is taking shape.",
  "Fifty more on the board — {team} reaches {score} and the momentum is building.",
  "The total races past {score} for {team} — this innings is really coming together now.",
  "{team} ticks past {score}! The required rate is looking healthier by the ball.",
  "Milestone moment — {team} crosses {score} runs, and the innings is well and truly launched.",
  "That takes {team} to {score}. Composed batting, building block by block.",
];

export function bowledOutLine(delivery: DeliveryKind): string {
  return pick(BOWLED_OUT_LINES[delivery]);
}

/** Score-based milestone commentary, fired whenever the total crosses a multiple of 50. */
export function milestoneLine(score: number, team: string): string {
  return pick(MILESTONE_LINES).replace(/\{team\}/g, team).replace(/\{score\}/g, String(score));
}

export function sixLine(shot: ShotKind): string {
  return pick(SIX_LINES[shot]);
}

export function fourLine(shot: ShotKind): string {
  return pick(FOUR_LINES[shot]);
}

export function caughtOutLine(shot: ShotKind): string {
  return pick(CAUGHT_OUT_LINES[shot]);
}

export function runLine(runs: 1 | 2 | 3): string {
  return pick(RUN_LINES[runs]);
}

export function runOutLine(runs: 1 | 2 | 3): string {
  return pick(RUN_OUT_LINES[runs]);
}