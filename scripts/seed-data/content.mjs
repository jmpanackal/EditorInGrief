/**

 * Topic / voice / structure packs and earnest body composition.

 * Tone: believable that the writer is serious — including sincere cringe.

 */



import { pick, CITIES } from './pools.mjs';



export const TOPICS = [

  'workplace', 'promotion', 'career_advice', 'parenting', 'personal_finance',

  'fitness', 'education', 'small_business', 'customer_experience', 'remote_work',

  'ai_at_work', 'volunteering', 'travel', 'food', 'sports',

  'community', 'housing', 'family', 'pets', 'startup',

  'healthcare', 'teaching', 'trades', 'commute', 'gratitude',

];



export const VOICES = [

  'plain_professional', 'warm_gratitude', 'measured_critique', 'instructional',

  'reflective_story', 'parent_update', 'community_neighbor', 'industry_peer',

  'customer_review', 'newsroom', 'hr_formal', 'casual_online',

];



export const STRUCTURES = [

  'short_update', 'story_lesson', 'short_list', 'quote_reply', 'thread_beats',

  'opinion_support', 'news_lede', 'before_after', 'open_letter', 'howto_steps',

  'qa_self_interview', 'timeline_week', 'myth_vs_reality', 'email_forward',

  'metrics_then_human', 'two_voices',

];



/** Earnest beats per topic — written as something a real person might post. */

const BEATS = {

  workplace: {

    hooks: [

      'Had a hard conversation with my team today.',

      'We closed a project that took nine months.',

      'I want to share something I got wrong at work last week.',

      'Quiet feedback from a junior teammate stopped me in my tracks.',

      'I canceled a recurring meeting that had outlived its purpose.',

      'Our standup ran long because nobody had written anything down beforehand.',

      'I finally said out loud that the timeline was fiction.',

      'A cross-team handoff failed in a very predictable way.',

      'I spent an afternoon unblocking someone instead of polishing slides.',

      'We shipped something imperfect and then supported it properly.',

      'I asked for a decision owner and got three volunteers and zero clarity.',

      'Today I learned my "quick sync" had become twelve people\'s calendar tax.',

    ],

    details: [

      'We missed a deadline because I assumed silence meant agreement.',

      'Two people on the team had been carrying context that never made it into the doc.',

      'I asked for honesty and then defended myself for the first ten minutes.',

      'The client was fine. The process was not.',

      'The blocker was not technical. It was three teams waiting on each other politely.',

      'I rewrote the agenda as questions instead of status theater.',

      'Someone had the answer in a chat from March that nobody could find.',

      'We kept optimizing a workflow that should have been deleted.',

      'I scheduled a follow-up and put the decision in writing within an hour.',

      'The meeting ended when we named the tradeoff instead of searching for consensus.',

      'A contractor had been guessing requirements because we never shared the brief.',

      'I stopped mid-sentence when I realized I was restating what they already knew.',

    ],

    lessons: [

      'Writing things down is not bureaucracy. It is respect.',

      'If you lead, your calendar is a culture document.',

      'Speed without clarity just creates expensive rework.',

      'I am trying to listen longer before I problem-solve.',

      'Ambiguity is not kindness when people need a call.',

      'Status updates belong in writing. Meetings are for decisions.',

      'Protecting focus time is part of delivering, not a personal luxury.',

      'The quietest person in the room often has the missing constraint.',

      'Ownership without authority is just anxiety with a title.',

      'A good retro names the system, not the scapegoat.',

      'Clarify the definition of done before you celebrate starting.',

      'My job includes removing friction other people cannot see.',

    ],

  },

  promotion: {

    hooks: [

      'I am excited to share that I am starting a new role next month.',

      'Today I accepted an offer I was not sure I was ready for.',

      'After three years on this team, I am taking the next step.',

      'I got the promotion I almost talked myself out of applying for.',

      'New title, same desk, very different expectations.',

      'I am moving into a lead role and feeling both proud and nervous.',

      'This week I got news that changes how I show up at work.',

      'A manager believed in me before I had the language for it.',

      'I am stepping into scope I used to watch from the sidelines.',

      'Promotion update: the hard part starts after the announcement.',

      'I said yes to a stretch role and then sat quietly with the doubt.',

      'Sharing a career milestone that felt overdue and still scary.',

    ],

    details: [

      'I will be managing a larger scope and mentoring two new hires.',

      'The title changes, but the expectations change more.',

      'I almost talked myself out of applying because I only met 80% of the list.',

      'The interview panel asked about failures more than wins, which felt fair.',

      'I negotiated for clarity on success metrics, not just compensation.',

      'My first week will be listening tours, not grand plans.',

      'I am inheriting a backlog that needs triage, not heroics.',

      'People already treat me differently in meetings, which is weird and informative.',

      'I asked for a 90-day checkpoint so feedback is not a surprise later.',

      'The team needs steadiness more than a new slogan.',

      'I am documenting how decisions get made so I do not become a bottleneck.',

      'Support from peers mattered more than the LinkedIn congratulations.',

    ],

    lessons: [

      'Apply anyway. The list is a wish list, not a gate.',

      'I am grateful to the managers who gave me stretch work before I felt ready.',

      'Celebrating publicly still feels awkward, but hiding it helps no one.',

      'Readiness is often built after the yes, not before it.',

      'A promotion is a trust transfer. Treat it that way.',

      'New authority without new listening is just louder guessing.',

      'Ask what the role is measured on in practice, not in the job post.',

      'You can be grateful and still negotiate.',

      'The people who advocated for you deserve a private thank-you.',

      'Imposter feelings are data, not a veto.',

      'Lead the work you already know before reinventing everything.',

      'Visibility of your work is part of the job, not vanity.',

    ],

  },

  career_advice: {

    hooks: [

      'A question I get a lot: how do you grow without burning out?',

      'If I could tell my earlier self one career thing, it would be this.',

      'Some practical advice I wish was said out loud more often.',

      'Career note from someone who learned the hard way about vague goals.',

      'I was asked how I got staffed on better projects. Here is the boring answer.',

      'Unsolicited advice I actually follow myself.',

      'A framework that helped me stop flailing between opportunities.',

      'If your career feels stuck, check the feedback loops first.',

      'I keep a simple system for deciding what to say yes to.',

      'Mentorship works better when both sides bring agendas.',

      'Here is what changed when I started tracking outcomes, not hours.',

      'Career growth is less mysterious than people make it sound.',

    ],

    details: [

      'Keep a weekly brag doc. Future you will need receipts.',

      'Ask what success looks like before you start the work.',

      'Your network is not a contact list. It is people you actually help.',

      'I schedule one skill block a week and defend it like a client call.',

      'I ask for feedback while the project is still warm, not at review season.',

      'Saying no to low-leverage work created space for visible work.',

      'I stopped waiting to be discovered and started proposing scoped experiments.',

      'A mentor asked me what problem I want to be known for solving.',

      'I write down wins the same week they happen, not when I panic later.',

      'Shadowing someone for a day taught more than three webinars.',

      'I renegotiated a recurring task that was eating my deep-work mornings.',

      'The people who advance often leave a trail of clear handoffs.',

    ],

    lessons: [

      'Consistency beats intensity most years.',

      'Titles are lagging indicators. Skills are leading ones.',

      'Protect deep work like it is a meeting with your future paycheck.',

      'Ask for the assignment that scares you a little, not the one that flatters you.',

      'Relationships compound when you follow through.',

      'Documenting your impact is not bragging. It is translation.',

      'Burnout often starts as calendar neglect.',

      'Choose managers who develop people, not just extract output.',

      'A small public portfolio beats a perfect private draft.',

      'Career advice without context is noise. Adapt it to your constraints.',

      'Your reputation is the sum of closed loops.',

      'Growth requires recovery time, not just ambition.',

    ],

  },

  parenting: {

    hooks: [

      'School drop-off taught me more about patience than any workshop.',

      'Parenting update from a very average Tuesday.',

      'My kid asked a question I could not answer cleanly.',

      'We had a meltdown in the grocery store and survived it.',

      'Tonight\'s bedtime negotiation felt like labor talks.',

      'I am learning that kids do not need a perfect parent, just a present one.',

      'Parenting note: the afternoon snack is a whole personality.',

      'We tried a new morning routine and it lasted exactly four days.',

      'My child taught me something about fairness I was not ready for.',

      'Weekend parenting energy is a different sport than weekday parenting.',

      'I caught myself rushing a conversation that needed slowness.',

      'Small parenting win that will not make a highlight reel.',

    ],

    details: [

      'We are negotiating screen time like it is a union contract.',

      'Bedtime took 40 minutes and involved three cups of water.',

      'I caught myself using my work voice at home and had to reset.',

      'The backpack still had last week\'s permission slip crumpled at the bottom.',

      'We practiced apologizing after I snapped about shoes by the door.',

      'Homework turned into a quiet sit-together, not a lecture.',

      'I put my phone in another room for the first hour after pickup.',

      'They wanted to show me a drawing mid-email. The drawing won.',

      'We named the feeling before we tried to fix the behavior.',

      'Car rides are when the real questions arrive.',

      'I stopped correcting every detail and listened for the story underneath.',

      'Dinner was simple and the conversation was better for it.',

    ],

    lessons: [

      'Being present is harder than being productive.',

      'Kids notice what we prioritize, not what we post.',

      'I am learning to apologize to a seven-year-old without making it a speech.',

      'Routines reduce friction more than pep talks do.',

      'Connection before correction still works when I remember it.',

      'Your calm is a co-regulation tool, not a personality trait you either have.',

      'Protect one unhurried stretch of the evening.',

      'Children need witnesses more than they need performance.',

      'Repair after conflict is the actual parenting skill.',

      'Lower the bar for the house, raise the bar for warmth.',

      'Ask what help looks like before you offer solutions.',

      'The goal is a relationship that survives the messy seasons.',

    ],

  },

  personal_finance: {

    hooks: [

      'We finally automated our sinking funds and it reduced a lot of low-grade stress.',

      'Money update: nothing flashy, just systems that work.',

      'I used to avoid looking at our budget. That was the expensive habit.',

      'We ran a quiet money meeting and it went better than expected.',

      'I canceled two subscriptions I had forgotten existed.',

      'Personal finance note from someone who likes spreadsheets too much.',

      'We gave every dollar a job and the anxiety got quieter.',

      'I negotiated a bill and felt weirdly proud about twenty-seven dollars.',

      'Cash flow clarity beat any new income for my stress levels this month.',

      'We built a small emergency buffer and slept better immediately.',

      'Money talk with my partner used to be tense. Practice helped.',

      'I am sharing a boring money win because boring is the point.',

    ],

    details: [

      'We separated rent, groceries, and annual bills into different buckets.',

      'The first month felt restrictive. Month three felt calm.',

      'I negotiated one bill and found $27 a month we were wasting.',

      'We track categories weekly, not with guilt, just with eyes open.',

      'I moved payday transfers to happen automatically before I could "decide later."',

      'We named sinking funds after real events: car tires, gifts, travel.',

      'A fee surprise taught us to read statements on the first of the month.',

      'We agreed on a no-blame rule before opening the spreadsheet.',

      'I cut dining out for two weeks and redirected it to the buffer.',

      'Insurance review found coverage we were paying for twice.',

      'We set a fun money line so the budget does not feel like punishment.',

      'I finally logged the cash spending that used to vanish from the plan.',

    ],

    lessons: [

      'Boring money is good money.',

      'A small system you follow beats a perfect spreadsheet you abandon.',

      'Talking about money with your partner is a skill, not a vibe.',

      'Automation removes decision fatigue where it hurts most.',

      'Clarity reduces conflict more than frugality lectures do.',

      'Name the expense before it ambushes you.',

      'Shame is a terrible budgeting tool.',

      'Progress is measured in months of calm, not viral hacks.',

      'Know your fixed costs cold before you chase side income.',

      'A buffer buys options, not just safety.',

      'Review subscriptions like you review recurring meetings.',

      'Shared goals make shared budgets less personal.',

    ],

  },

  fitness: {

    hooks: [

      'Four months into lifting consistently and the scale is the least interesting metric.',

      'I stopped chasing perfect workouts and started chasing finished ones.',

      'Gym note from someone who used to skip Mondays.',

      'I walked every day this week and it changed my evenings.',

      'Training update: sleep fixed more than any new program did.',

      'I finally booked the session for a time I actually protect.',

      'Fitness is logistics dressed up as motivation.',

      'I deloaded on purpose and came back stronger, which still surprises me.',

      'Showing up sore and leaving proud is allowed.',

      'I swapped one scroll session for a short mobility block.',

      'Consistency check-in from a very average training week.',

      'I stopped negotiating with myself at 6 a.m. and just went.',

    ],

    details: [

      'I track sleep more carefully than I track PRs.',

      'Showing up for 35 minutes still counts.',

      'My trainer made me slow down the eccentric and everything got harder in a useful way.',

      'I keep a gym bag by the door so friction cannot win.',

      'Protein at breakfast made afternoon cravings less dramatic.',

      'I write the next workout in the calendar before I leave the current one.',

      'Walking meetings replaced two coffees that were mostly sitting.',

      'I missed three days, then restarted without a dramatic reboot speech.',

      'Warm-ups used to feel optional. They are not.',

      'I measure progress by how stairs feel, not only by the mirror.',

      'A friend texts me on lift days. Accountability is underrated.',

      'I chose a program I can finish on a busy week, not a fantasy week.',

    ],

    lessons: [

      'Discipline is mostly logistics.',

      'You cannot out-train a calendar you refuse to defend.',

      'Progress compound interest is real if you stop resetting every January.',

      'Finished beats perfect most Tuesdays.',

      'Recovery is training, not a reward you earn later.',

      'Small sessions keep the identity alive.',

      'Environment design beats willpower speeches.',

      'Compare yourself to last month, not to an influencer\'s highlight.',

      'Mobility work prevents the dramatic setbacks.',

      'A sustainable pace is a competitive advantage.',

      'Show up for the boring weeks. That is where fitness is built.',

      'Your future joints are counting on today\'s unglamorous choices.',

    ],

  },

  education: {

    hooks: [

      'I went back for a certificate while working full time.',

      'Learning in public is uncomfortable and useful.',

      'Office hours with a professor reminded me what good teaching feels like.',

      'I finished a course I almost abandoned in week three.',

      'Study note: nights are finite, so priorities have to be honest.',

      'I asked a basic question in class and three people thanked me later.',

      'Continuing education update from a tired but curious adult.',

      'The cohort Discord has been half the value of the tuition.',

      'I am learning how to be a beginner again on purpose.',

      'A failed quiz taught me more than the quizzes I coasted through.',

      'I blocked study hours like client work and finally stuck with them.',

      'Education check-in: progress is uneven and still worth it.',

    ],

    details: [

      'Nights and weekends are not infinite. I had to cut something else.',

      'The cohort chat has been as valuable as the lectures.',

      'I failed one quiz and learned more from that than the ones I passed.',

      'I print the syllabus and highlight deadlines like a project plan.',

      'Office hours felt intimidating until I went once and stayed going.',

      'I take messy notes and rewrite one clean page within 24 hours.',

      'Group projects taught me as much about collaboration as content.',

      'I turned off notifications during the two-hour study block.',

      'A librarian helped me find sources I would have missed entirely.',

      'I explain new concepts out loud to an empty room. It works.',

      'I chose electives that stretch me, not ones that pad the GPA easily.',

      'Flashcards on the commute replaced doomscrolling for a month.',

    ],

    lessons: [

      'Credentials open doors. Curiosity keeps you in the room.',

      'Ask the basic questions early.',

      'Education is a long game dressed up as short assignments.',

      'Being a beginner again is a professional skill.',

      'Community accelerates learning more than solo grind does.',

      'Schedule the study block before motivation arrives.',

      'Failure on a low-stakes quiz is cheap tuition.',

      'Teach back what you learn or you did not really learn it.',

      'Protect sleep even during exam weeks. Memory needs it.',

      'Choose programs for the problems you want to solve, not the brand alone.',

      'Adult learning works when life logistics are respected.',

      'Progress is showing up after the novelty wears off.',

    ],

  },

  small_business: {

    hooks: [

      'Small business owners: the admin work is the job sometimes.',

      'We had our best week and our messiest week in the same month.',

      'Running a shop taught me more about cash flow than any course.',

      'I closed the laptop at a humane hour and the business survived.',

      'Customer thank-you notes are still the best marketing we get.',

      'Inventory day is my least favorite holiday and also necessary.',

      'We raised prices carefully and kept the regulars who value the work.',

      'Small business update: systems beat hustle speeches.',

      'I hired help before I felt "ready" and it was still the right call.',

      'A slow Tuesday taught me which offerings actually carry the rent.',

      'We finally wrote down the opening checklist so anyone can run it.',

      'Owner note: your energy is a finite inventory item.',

    ],

    details: [

      'Inventory mistakes are expensive teachers.',

      'One loyal regular is worth ten one-time discount hunters.',

      'I started closing the laptop at 8 so I still have a life outside the business.',

      'We tracked which SKUs sit and which ones turn. Ego products lost.',

      'I batch admin on Wednesdays so the rest of the week can be customer-facing.',

      'A supplier delay forced a menu change customers actually liked.',

      'We trained the team on one upsell that feels helpful, not pushy.',

      'I called three past customers just to check in, no pitch.',

      'Bookkeeping caught a leak we would have missed for months.',

      'We posted hours clearly and reduced the "are you open" texts.',

      'I wrote a simple refund policy and arguments got shorter.',

      'The first hire needed clearer SOPs than I thought I had.',

    ],

    lessons: [

      'Margins matter more than vanity revenue.',

      'Systems let you be kind to customers without burning out staff.',

      'Ask for the review. Most happy people just forget.',

      'Cash timing can kill a profitable-looking month.',

      'Your calendar should include recovery, not only openings.',

      'Document the job so the business is not trapped in your head.',

      'Price for sustainability, not for winning a popularity contest.',

      'Regulars are a retention strategy and a community.',

      'Admin debt compounds faster than product debt.',

      'Hire for trust and train for skill when you can.',

      'A quiet process beats a charismatic scramble.',

      'Protect the owner\'s focus like you protect payroll.',

    ],

  },

  customer_experience: {

    hooks: [

      'A support ticket today reminded me why tone matters.',

      'We fixed a bug and then fixed how we talk about bugs.',

      'Customer experience is not a department. It is a series of tiny moments.',

      'I rewrote one help article and ticket volume dropped in that category.',

      'A customer was right, and admitting it early saved the relationship.',

      'We measured reply time and found the silence was the real complaint.',

      'CX note: clarity beats cleverness in every status email.',

      'I shadowed support for a morning and came back humbled.',

      'We stopped promising "soon" and started giving dates we can hit.',

      'A recovery after a mistake earned more trust than a flawless order.',

      'I asked customers what "good" looks like instead of guessing.',

      'Service design update from someone who used to ship and pray.',

    ],

    details: [

      'The customer was not angry about the delay. They were angry about the silence.',

      'A clear ETA beats a hopeful maybe.',

      'We added one sentence to our emails and reply rates improved.',

      'I replaced jargon with the next concrete step the customer can take.',

      'We routed urgent issues to a human faster and let bots handle FAQs.',

      'A refund processed same-day changed the whole tone of the thread.',

      'We logged the top ten complaints and fixed three root causes this sprint.',

      'I called instead of emailing when the situation was emotional.',

      'We trained the team on listening first, script second.',

      'A packaging change reduced damage claims more than any apology template.',

      'I read five lost customers\' last messages and found a pattern.',

      'We published status updates before people had to ask.',

    ],

    lessons: [

      'Respect people enough to be specific.',

      'Apology without a next step is just noise.',

      'Make the easy path the right path for your users.',

      'Silence is a product decision, whether you intend it or not.',

      'Measure the moments customers actually feel.',

      'Recovery is a skill you can train.',

      'Frontline people know the roadmap gaps first.',

      'Promises should be smaller than your capacity.',

      'Tone is part of the product.',

      'Fix the system that creates the ticket, not only the ticket.',

      'Customers forgive mistakes. They remember how you handled them.',

      'Clarity reduces support load better than speed alone.',

    ],

  },

  remote_work: {

    hooks: [

      'Remote work is great until your calendar becomes a group chat with video.',

      'We adjusted our async norms and meetings got shorter.',

      'Working from home still requires boundaries I have to renew weekly.',

      'I blocked focus time and treated it like a client meeting.',

      'Timezone math is now part of how I plan the week.',

      'Remote update: cameras on is not the same thing as culture.',

      'I moved status to a doc and reclaimed three hours of calls.',

      'Home office note: the commute used to be my buffer. I had to rebuild one.',

      'We set core overlap hours and stopped expecting 24/7 presence.',

      'I started ending Slack days with a shutdown ritual.',

      'Async writing improved our decisions more than another standup did.',

      'Remote work only works if decisions are findable later.',

    ],

    details: [

      'Cameras on is not culture. Clear decisions are culture.',

      'I block focus time and treat it like a client meeting.',

      'Timezone math is a real skill.',

      'I write the decision in the thread before hopping on a call.',

      'We keep a living FAQ so new hires are not stuck waiting on chat.',

      'I take a real lunch away from the desk most days now.',

      'Recording optional meetings helped people in other zones catch up.',

      'I turned off badges after hours except for true on-call.',

      'A weekly written plan replaced Monday meeting theater.',

      'We agree on response-time expectations by channel.',

      'I use a separate browser profile for work to reduce context bleed.',

      'Walking outside between calls is not optional for my brain.',

    ],

    lessons: [

      'Default to writing. Meet to decide.',

      'Presence is not the same as availability.',

      'A good home setup is a workplace benefit you fund yourself if nobody else will.',

      'Async trust is built by reliable follow-through.',

      'Boundaries are team agreements, not personal quirks.',

      'Document decisions where the work lives.',

      'Overlap hours beat always-on culture.',

      'Remote teams fail when context is trapped in heads.',

      'Protect deep work across time zones intentionally.',

      'Social connection still needs deliberate design.',

      'Your calendar should reflect priorities, not anxiety.',

      'Shutdown rituals prevent remote work from colonizing the evening.',

    ],

  },

  ai_at_work: {

    hooks: [

      'We started using AI tools on draft work, not final work.',

      'AI did not replace my job. It changed which parts feel heavy.',

      'A note on AI at work from someone still learning the limits.',

      'I used a model to outline, then did the judgment myself.',

      'We banned pasting confidential client data into public tools.',

      'AI update: speed is easy, quality still needs a human owner.',

      'I asked the tool for options and then argued with the options.',

      'Our team wrote a simple AI use policy before the chaos arrived.',

      'I caught a confident wrong answer and it recalibrated my trust.',

      'Drafting with AI saved time. Editing still took honesty.',

      'We use AI for first passes on repetitive formatting, not strategy.',

      'Learning how to prompt well is becoming a workplace literacy.',

    ],

    details: [

      'It is fast at first drafts and sloppy at judgment.',

      'We ban pasting confidential client data into public tools. Non-negotiable.',

      'The best results still need a human who knows what good looks like.',

      'I keep a checklist: source, accuracy, tone, and permission.',

      'We label AI-assisted drafts so reviewers know what to scrutinize.',

      'I use it to generate test cases I might have missed.',

      'A hallucinated citation almost made it into a client memo.',

      'We compared three prompts and kept the one that asked for uncertainty.',

      'Junior folks still need mentorship more than autocomplete.',

      'I rewrite outputs in my own voice before anything ships.',

      'Time saved on drafting moved into deeper review, which is the point.',

      'We log where AI helped and where it created rework.',

    ],

    lessons: [

      'Treat it like a junior assistant: useful, not unsupervised.',

      'Speed is not quality.',

      'If you cannot explain the output, you cannot ship the output.',

      'Policy beats vibes when tools move this fast.',

      'Human judgment is still the product.',

      'Confidentiality rules apply to prompts too.',

      'AI literacy includes knowing when not to use it.',

      'Cite and verify, especially when it sounds polished.',

      'The bottleneck shifts from typing to taste.',

      'Train people on evaluation, not only on prompting tricks.',

      'Accountability stays with the person who hits send.',

      'Tools change workflows. They do not replace standards.',

    ],

  },

  volunteering: {

    hooks: [

      'Spent Saturday morning volunteering and came home tired in a good way.',

      'Community work does not need to be photogenic to matter.',

      'We sorted donations for three hours and barely made a dent, which means the need is real.',

      'I signed up for a recurring shift instead of a one-time splash.',

      'Volunteering update: the organizers needed hands more than advice.',

      'I met neighbors I had only ever waved at from a driveway.',

      'Service day reminded me how local problems actually get solved.',

      'We packed meals and talked less about politics than about logistics.',

      'I brought a friend and that doubled the impact without doubling the drama.',

      'Showing up quietly still counts as showing up.',

      'A volunteer lead thanked us by name. That stuck with me.',

      'I gave time this month when money was tighter than usual.',

    ],

    details: [

      'Show up consistently beats showing up loudly once.',

      'The organizers needed hands more than they needed advice.',

      'I met neighbors I had only ever waved at from a driveway.',

      'We followed the intake process instead of improvising "helpfulness."',

      'I learned the difference between what looks good and what is needed.',

      'Childcare made it possible for two parents to volunteer longer.',

      'We labeled boxes carefully so the next shift would not redo our work.',

      'A regular volunteer taught me the unglamorous backbone tasks.',

      'I put the next date on my calendar before leaving.',

      'Transportation was the hidden barrier for several people trying to help.',

      'We stayed for cleanup, which is where half the work lives.',

      'I asked what skills were scarce instead of assuming mine were.',

    ],

    lessons: [

      'Service recalibrates your sense of urgency.',

      'Give time when money is tight. Give money when time is tight.',

      'Local problems are not abstract.',

      'Consistency builds trust with organizers and neighbors.',

      'Listen before you redesign someone else\'s system.',

      'Dignity matters as much as efficiency.',

      'Small recurring shifts beat rare heroic days.',

      'Community care is maintenance work.',

      'Invite one person with you. Networks grow that way.',

      'Skill-based volunteering multiplies impact when matched well.',

      'Thank the people who coordinate. Coordination is labor.',

      'Proximity changes what you think is possible.',

    ],

  },

  travel: {

    hooks: [

      'Back from a short trip and already romanticizing the airport coffee.',

      'Travel reminder: build in a buffer day.',

      'I packed light for once and it changed the whole week.',

      'Missed a connection and learned how kind strangers can be.',

      'I put the phone away for one museum and remembered how to look.',

      'Trip note: the best meal was not the famous one.',

      'We walked more than we planned and it fixed the itinerary.',

      'Travel update from someone who over-schedules and is reforming.',

      'A quiet hotel breakfast beat the bucket-list rush.',

      'I left room for an unplanned afternoon and it became the highlight.',

      'Coming home is part of the trip. I am treating it that way.',

      'Packing cubes are not a personality, but they helped.',

    ],

    details: [

      'Missed a connection and learned how kind strangers can be.',

      'The best meal was not the famous one. It was a quiet lunch near our hotel.',

      'I put the phone away for one museum and remembered how to look.',

      'We booked the mid-morning flight and arrived as people, not wreckage.',

      'A local transit pass beat three separate ride apps.',

      'I kept one afternoon empty on purpose and filled it with wandering.',

      'Shared a table with travelers who recommended a park we would have skipped.',

      'I packed one nicer outfit and felt ready for the unexpected dinner.',

      'Jet lag hit less when I walked outside on arrival day.',

      'We photographed less and talked more about what we saw.',

      'A museum membership line saved us an hour we spent in a bookstore instead.',

      'I wrote three sentences each night so the trip would not blur.',

    ],

    lessons: [

      'Plans are useful. Rigidity is not.',

      'Leave room for the unplanned good thing.',

      'Coming home is part of the trip.',

      'Travel lighter so you can move freer.',

      'Buffers are hospitality to your future self.',

      'Attention is the real souvenir.',

      'Local pace beats checklist tourism.',

      'Kindness from strangers is a travel skill you can also practice.',

      'Rest days make the active days better.',

      'Money spent on location beats money spent on more stuff in the suitcase.',

      'Write a little so memory has handles later.',

      'The trip continues in how you return to ordinary days.',

    ],

  },

  food: {

    hooks: [

      'Cooked a complicated recipe on a weeknight and regretted the timing, not the food.',

      'Restaurant note: service recovered a mistake so well I will go back.',

      'I am trying to meal prep without turning Sundays into a second job.',

      'Shared a table with friends and the week got lighter.',

      'I finally salted early and tasted as I went. Small revolution.',

      'Food update: simple dinners are saving our weeknights.',

      'A baker remembered my order and I felt weirdly cared for.',

      'We tried a new spot and tipped like we meant it.',

      'I batch-cooked grains and suddenly lunches existed.',

      'Cooking for someone else reset my mood more than scrolling did.',

      'Grocery list discipline beat another delivery fee.',

      'Kitchen note from someone learning to cook without the performance.',

    ],

    details: [

      'Salt earlier. Taste more. Rush less.',

      'The dish was fine. The expectations were the problem.',

      'Sharing food with friends fixed a rough week more than I expected.',

      'I prepped onions and sauces on Sunday so Tuesday had a chance.',

      'The restaurant owned the mistake, remade the plate, and checked back once.',

      'We kept a running list of "easy wins" meals for drained evenings.',

      'I bought better olive oil and cheaper snacks. Priorities.',

      'Leftovers got intentional names so they did not feel like punishment.',

      'A farmers market tomato made a plain sandwich feel special.',

      'I asked the server for the dish they actually like. Good call.',

      'We cooked one cuisine for a month to build real fluency.',

      'Cleaning as I cook is still a skill I practice on purpose.',

    ],

    lessons: [

      'Feeding people is a love language that still needs a grocery list.',

      'Simple food done well beats ambitious food done stressed.',

      'Leave restaurants better than you found them. Tip like you mean it.',

      'Prep reduces weeknight decision fatigue.',

      'Hospitality includes how you recover from mistakes.',

      'Shared meals are infrastructure for friendship.',

      'Taste as you go. Recipes are suggestions with structure.',

      'Budget and joy can share a kitchen.',

      'Repeat meals are not failure. They are systems.',

      'Support the places that treat staff and guests with care.',

      'Cooking skill compounds quietly.',

      'Food is culture, logistics, and comfort in the same bowl.',

    ],

  },

  sports: {

    hooks: [

      'That game was a masterclass in not giving up in the third quarter.',

      'Youth sports sideline energy is a lot, and also kind of beautiful.',

      'I am choosing one team hobby this season so I actually enjoy it.',

      'We lost, and the kids still wanted ice cream. Correct priorities.',

      'Sports note: process talk beats scoreboard talk after a tough game.',

      'My voice was gone by the fourth quarter and I am not sorry.',

      'I coached a practice focused on effort cues, not highlight plays.',

      'Fandom is more fun when it is not my whole personality.',

      'Midweek game attendance is how you know you mean it.',

      'A bad call happened. The players handled it better than the stands.',

      'I started playing again pickup-style and remembered why I liked it.',

      'Season update: showing up for teammates is the actual sport.',

    ],

    details: [

      'The call was bad. The response from the players was professional.',

      'My voice was gone by the fourth quarter and I am not sorry.',

      'We lost, and the kids still wanted ice cream. Correct priorities.',

      'Practice ended with a habit drill that looked boring and mattered.',

      'I thanked the refs even when I disagreed. Kids were watching.',

      'We rotated playing time more fairly and chemistry improved.',

      'Film review was five minutes of specifics, not a rant.',

      'A bench player changed the energy when they entered. Notice that.',

      'I packed water and snacks like a logistics coordinator.',

      'We celebrated hustle plays louder than highlight plays.',

      'Injuries taught us to warm up like we mean it.',

      'I learned the opposing coach\'s name and the tone of the rivalry softened.',

    ],

    lessons: [

      'Process over scoreboard when you are developing people.',

      'Fandom is more fun when it is not your whole personality.',

      'Show up for the boring midweek games too.',

      'Sideline behavior is part of the coaching curriculum.',

      'Effort is a skill you can reinforce.',

      'Sportsmanship is a public practice.',

      'Teams remember who stayed steady after mistakes.',

      'Rest and recovery belong in the training plan.',

      'Joy is a performance factor, not a distraction.',

      'Youth sports should still feel like play sometimes.',

      'Respect officials even when the call stings.',

      'Being a good teammate outlasts any single season.',

    ],

  },

  community: {

    hooks: [

      'Neighborhood meeting ran long and still worth it.',

      'We got the crosswalk paint refreshed after six months of emails.',

      'Community update: small wins count.',

      'Library event had more kids than chairs. Good problem.',

      'I finally attended the association meeting I always skip.',

      'One organized neighbor can move a bureaucracy, slowly.',

      'We started a tool library on our block and it is catching on.',

      'Community note: belonging is built in ordinary appearances.',

      'I listened to someone I disagree with and stayed for the whole agenda.',

      'A park cleanup turned into introductions I had needed for years.',

      'We posted a mutual aid request and the response was practical, not performative.',

      'Civic life is maintenance, not a viral moment.',

    ],

    details: [

      'One organized neighbor can move a bureaucracy, slowly.',

      'Listening to people you disagree with is part of living near them.',

      'The library event had more kids than chairs. Good problem.',

      'We collected signatures the old-fashioned way: walking and talking.',

      'I brought cookies to the meeting and people stayed for the hard item.',

      'A city staffer explained the process without jargon for once.',

      'We mapped who already does the work before inventing a new group.',

      'The group chat works better when it has a weekly digest.',

      'I volunteered for the unglamorous treasurer role. Somebody had to.',

      'We translated flyers so more households could participate.',

      'A disagreement stayed about the proposal, not about people\'s character.',

      'Follow-up emails after the meeting are where progress actually happens.',

    ],

    lessons: [

      'Civic life is maintenance, not a viral moment.',

      'Ask what is needed before you announce what you will do.',

      'Belonging is built in repeated ordinary appearances.',

      'Patience is a community organizing skill.',

      'Shared spaces need shared stewardship.',

      'Listen across difference without abandoning your values.',

      'Small infrastructure wins change daily life.',

      'Credit the quiet people who keep things running.',

      'Show up before you have a hot take.',

      'Local power is often procedural. Learn the procedures.',

      'Hospitality makes meetings survivable.',

      'Community is a practice of returning.',

    ],

  },

  housing: {

    hooks: [

      'Homeownership is a second unpaid job with surprise invoices.',

      'We finally fixed the leak that taught us to love plumbers.',

      'Renting update: stability is a feature.',

      'I got three quotes. The first number was fantasy.',

      'A small repair ignored became a story we tell angrily now.',

      'Housing note: neighbors who share tools are a wealth system.',

      'We budgeted for the house to break because it will.',

      'I learned which DIY projects are ego and which are savings.',

      'Lease renewal conversation went better when we prepared numbers.',

      'Home maintenance day is not glamorous and it protects weekends later.',

      'We insulated one room and the energy bill noticed.',

      'Shelter stress is real. Talking about it helped.',

    ],

    details: [

      'Get three quotes. The first number is rarely the real number.',

      'A small repair ignored becomes a story you tell angrily later.',

      'I am learning which DIY projects are ego and which are savings.',

      'We keep a home binder with warranties and paint colors.',

      'The plumber explained the fix in plain language and earned a referral.',

      'I scheduled HVAC service before summer panic prices.',

      'We negotiated a rent increase with comps and a clean payment history.',

      'Moisture under the sink was the early warning we almost dismissed.',

      'A neighbor lent a ladder and advice that saved a weekend.',

      'We finally labeled the breaker panel like adults.',

      'I photographed serial numbers before calling support.',

      'Moving boxes still in the garage are a tax on calm. We are clearing them.',

    ],

    lessons: [

      'Budget for the house to break. It will.',

      'Neighbors who share tools are a wealth system.',

      'Shelter stress is real. Talk about it without shame.',

      'Preventive maintenance is cheaper than drama.',

      'Document everything before you need it.',

      'Quotes are research, not commitments.',

      'Know when to hire a licensed pro.',

      'Stability has value even when it is not Instagrammable.',

      'Small upgrades compound comfort.',

      'Landlord and tenant conversations go better with written facts.',

      'Your home systems deserve the same care as your calendar.',

      'Asking for help with housing logistics is allowed.',

    ],

  },

  family: {

    hooks: [

      'Called my parents for no reason and it improved both of our days.',

      'Family group chat energy is chaotic and I would not delete it.',

      'We are planning a gathering and learning that logistics are love.',

      'I checked on a quiet relative and I am glad I did.',

      'Family update: repair mattered more than being right.',

      'Someone has to book the restaurant. That someone is usually me.',

      'Old stories get funnier when the people in them are safe now.',

      'I practiced saying no to plans without writing an essay.',

      'We made a simple tradition and it stuck better than a big production.',

      'Family note: presence over presents, and also sometimes presents help.',

      'I sent photos from ordinary life, not only milestones.',

      'Sibling call ran long in the best way.',

    ],

    details: [

      'Someone has to book the restaurant. That someone is usually me.',

      'Old stories get funnier when the people in them are safe now.',

      'I am practicing saying no to plans without writing an essay.',

      'We divided hosting tasks so one person was not the unpaid event staff.',

      'I asked my dad about a job he had before I was born. He lit up.',

      'The group chat got a shared calendar and arguments dropped.',

      'We left politics at the door for one meal and talked about gardens.',

      'I mailed a handwritten note because texts disappear.',

      'Caregiving logistics needed a spreadsheet. Love still needed phone calls.',

      'We revisited a childhood place and it felt smaller and sweeter.',

      'I apologized for a sharp comment from last month. Timing still counts.',

      'Cousins I barely knew became familiar after one long weekend.',

    ],

    lessons: [

      'Presence over presents, and also sometimes presents help.',

      'Repair is more important than being right.',

      'Check on the quiet relatives.',

      'Logistics are a love language in extended families.',

      'Boundaries can be kind when they are clear.',

      'Ordinary updates keep relationships warm.',

      'Ask elders for stories while you can.',

      'Shared calendars reduce resentment.',

      'Forgiveness is a practice with follow-through.',

      'Not every gathering needs to be perfect to be meaningful.',

      'Name the person who always organizes and relieve them sometimes.',

      'Family health includes emotional maintenance.',

    ],

  },

  pets: {

    hooks: [

      'The dog does not care about my KPIs and that is healthy.',

      'Vet visit went fine. My wallet needs a moment.',

      'Pet ownership is mostly routines and tiny joys.',

      'Morning walks force me outside before Slack does.',

      'Training is patience practice with fur.',

      'She still steals socks. We are negotiating.',

      'Pet note: consistency matters more than fancy treats.',

      'I budgeted for the unexpected because pets specialize in it.',

      'Adopted-animal update: trust arrives on its own schedule.',

      'A rainy walk still counted. The dog voted yes.',

      'We finally found a food that agrees with everyone\'s stomach.',

      'Caretaking softens a hard week in ways I did not expect.',

    ],

    details: [

      'Morning walks force me outside before Slack does.',

      'Training is patience practice with fur.',

      'She still steals socks. We are negotiating.',

      'I keep a vet fund separate from fun money now.',

      'Short training sessions beat long frustrated ones.',

      'The cat chose my laptop as a throne during every important call.',

      'We crate-trained patiently and travel got easier.',

      'I learned body language cues I used to miss entirely.',

      'A neighbor dog meetup became a tiny social life for both of us.',

      'Nail trims go better with peanut butter diplomacy.',

      'I scheduled preventative care instead of waiting for a scare.',

      'Pet insurance paperwork is annoying and was worth it once.',

    ],

    lessons: [

      'Caretaking softens a hard week.',

      'Animals notice consistency.',

      'Budget for the unexpected. Pets specialize in it.',

      'Routines are love in animal language.',

      'Training is relationship work, not dominance theater.',

      'Outdoor time helps the human as much as the pet.',

      'Patience beats volume.',

      'Preventative care is kindness to future you.',

      'Play is enrichment, not optional fluff.',

      'Know your emergency clinic before you need it.',

      'Pets teach attention to the present moment.',

      'Responsible ownership includes planning for hard days.',

    ],

  },

  startup: {

    hooks: [

      'Startup life update: we shipped, then we listened.',

      'Fundraising conversations are emotional labor plus spreadsheets.',

      'Building in public is easier to say than to do on a rough week.',

      'One customer interview changed our roadmap more than a month of opinions.',

      'We cut a feature we loved because nobody used it.',

      'Cash runway math should be boring and frequent.',

      'Startup note: ego is expensive inventory.',

      'We wrote decisions down so a five-person team stays aligned.',

      'I pitched less and asked better discovery questions.',

      'Shipping weekly forced us to shrink scope honestly.',

      'A near-miss on payroll taught me to watch cash earlier.',

      'We hired slower after rushing once and paying for it.',

    ],

    details: [

      'One customer interview changed our roadmap more than a month of opinions.',

      'We cut a feature we loved because nobody used it.',

      'Cash runway math should be boring and frequent.',

      'I keep a weekly metrics review that is short and non-theatrical.',

      'We talk to users before polishing the wrong thing.',

      'The pitch deck got simpler when the story got clearer.',

      'I separated founder feelings from customer evidence in the doc.',

      'We set a kill criteria for experiments before launching them.',

      'Support tickets became a product research channel.',

      'Hiring scorecards reduced vibe-based decisions.',

      'We celebrated a retention win louder than a vanity signup spike.',

      'I blocked founder deep work before the Slack day opens.',

    ],

    lessons: [

      'Ego is expensive inventory.',

      'Talk to users before you polish the wrong thing.',

      'A small team still needs written decisions.',

      'Runway is a product constraint, not a spreadsheet hobby.',

      'Scope is a leadership act.',

      'Evidence beats internal mythology.',

      'Ship to learn, not to perform busyness.',

      'Culture is how you handle bad metrics.',

      'Hire for ownership and communication early.',

      'Fundraising is a means, not the mission.',

      'Retention tells the truth faster than applause.',

      'Write the strategy so it survives a busy week.',

    ],

  },

  healthcare: {

    hooks: [

      'Healthcare workers: the shift was long and the team carried each other.',

      'A patient thanked a nurse in a way that stuck with me all day.',

      'Clinic life is equal parts protocol and humanity.',

      'Breaks are not optional if you want safe care.',

      'We celebrated a quiet win that will never make a highlight reel.',

      'Documentation protected everyone, including the next clinician.',

      'Healthcare note: compassion without staffing is a slogan.',

      'I said thank you to the people who keep the floor moving.',

      'A hard conversation with a family went better when we slowed down.',

      'Shift update: teamwork showed up in the small handoffs.',

      'I finally used my PTO without apologizing for existing.',

      'Training a new hire reminded me what clarity looks like under pressure.',

    ],

    details: [

      'Breaks are not optional if you want safe care.',

      'Documentation protects everyone, including the next clinician.',

      'We celebrated a quiet win that will never make a highlight reel.',

      'I double-checked an order and caught a near miss.',

      'The unit ran smoother when assignments matched acuity honestly.',

      'A respiratory therapist taught me a trick that saved minutes we needed.',

      'We debriefed after a tough case without turning it into blame.',

      'I hydrated between rooms like it was part of the protocol.',

      'Family updates were clearer when we used plain language.',

      'Supply shortages forced creative but safe workarounds.',

      'I covered a colleague\'s break and they covered mine later. Reciprocity matters.',

      'Charting caught up in real time reduced the end-of-shift cliff.',

    ],

    lessons: [

      'Compassion without staffing is a slogan.',

      'Say thank you to the people who keep the floor moving.',

      'Rest is part of competence.',

      'Safety is a team sport.',

      'Plain language is clinical skill.',

      'Near misses deserve attention, not silence.',

      'Handoffs are where quality lives or dies.',

      'Support staff make care possible. Treat them that way.',

      'Emotional load needs recovery too.',

      'Protocols protect patients and clinicians.',

      'Celebrate the quiet saves.',

      'Advocacy for staffing is patient care upstream.',

    ],

  },

  teaching: {

    hooks: [

      'Teaching note: the lesson plan survived contact with actual teenagers.',

      'Parent email energy is a skill you learn the hard way.',

      'One student finally had the breakthrough after weeks of quiet work.',

      'I threw out half my slides and asked better questions.',

      'Classroom management is relationship work wearing a schedule.',

      'Grading late at night is a choice I am trying to make less often.',

      'Education update: clarity is kindness in the classroom.',

      'A student who rarely speaks offered the insight of the week.',

      'I modeled curiosity and watched it spread sideways.',

      'Parent conference went better when I led with specifics and care.',

      'We revised a rubric so students could actually use it.',

      'Public education runs on people who stay. I see you.',

    ],

    details: [

      'Classroom management is relationship work wearing a schedule.',

      'I threw out half my slides and asked better questions.',

      'Grading late at night is a choice I am trying to make less often.',

      'I greeted students at the door and the first five minutes calmed down.',

      'Exit tickets told me what the lesson actually taught.',

      'A quiet conference after class repaired more than a public correction.',

      'I planned transitions as carefully as the content blocks.',

      'Student work on the walls changed the room\'s ownership feel.',

      'I called home with a positive note before any problem appeared.',

      'Collaborative norms posted and practiced reduced friction.',

      'I differentiated by offering choice, not by lowering the bar quietly.',

      'Professional learning only helped when I tried one idea the next day.',

    ],

    lessons: [

      'Clarity is kindness.',

      'Curiosity is contagious when adults model it.',

      'Public education runs on people who stay.',

      'Relationships unlock learning more than new tech does.',

      'Feedback should be usable, not just evaluative.',

      'Protect planning time like instruction time.',

      'Student voice improves the lesson you thought was finished.',

      'Rest makes better teachers than martyrdom does.',

      'Specific praise builds the culture you want.',

      'Routines free cognitive space for thinking.',

      'Partner with families early, not only in crisis.',

      'Teaching is iterative design under human constraints.',

    ],

  },

  trades: {

    hooks: [

      'Trades update: apprenticeship is still one of the best career paths we underrate.',

      'Finished a job that looked simple on paper and was not.',

      'Respect to everyone who keeps buildings working while the rest of us complain online.',

      'Measure twice is not a proverb. It is a budget saver.',

      'The customer cared about cleanliness as much as the repair.',

      'Good mentors in the trades change lives quietly.',

      'I brought an apprentice through a tricky install today.',

      'Skill scarcity is real. Treat craftspeople well.',

      'Pride in neat work is a professional advantage.',

      'Trades note: show up early, leave the site better than you found it.',

      'A warranty callback taught me more than the first install did.',

      'We priced the job honestly and slept fine afterward.',

    ],

    details: [

      'Measure twice is not a proverb. It is a budget saver.',

      'The customer cared about cleanliness as much as the repair.',

      'Good mentors in the trades change lives quietly.',

      'I photographed the before state so the after was undeniable.',

      'We staged materials to reduce trips and protect the lawn.',

      'A hidden issue appeared mid-job and we called before surprising the bill.',

      'I labeled shutoffs clearly for the homeowner before leaving.',

      'Tool maintenance on Friday saved Monday\'s frustration.',

      'The apprentice asked a sharp question that improved the approach.',

      'We coordinated with another trade instead of fighting for space.',

      'I wrote a short handoff note for the next technician.',

      'Safety gear felt like delay until the near miss reminded me otherwise.',

    ],

    lessons: [

      'Skill scarcity is real. Treat craftspeople well.',

      'Pride in neat work is a professional advantage.',

      'Bring the next person up with you.',

      'Communication is part of the craft.',

      'Protect the site like it is your own home.',

      'Honest pricing builds long relationships.',

      'Apprenticeships create careers, not just labor.',

      'Document as you go. Memory is not a system.',

      'Safety shortcuts are expensive.',

      'Customers remember how you left the space.',

      'Mentorship multiplies skill across a generation.',

      'Quality work does not need to shout.',

    ],

  },

  commute: {

    hooks: [

      'Commute rant that is actually a systems observation.',

      'Transit delay taught me to leave earlier and complain less productively.',

      'I walked part of the way and arrived in a better mood.',

      'One unreliable transfer breaks a whole morning.',

      'Commute note: time is the real toll.',

      'I packed a backup plan and the delay hurt less.',

      'Podcasts help. Sleep helps more.',

      'Cities feel different when you are not sealed in a car.',

      'I shifted my start time by thirty minutes and dodged the crush.',

      'Bike commute season started and my calendar got honest about daylight.',

      'A calmer arrival is worth a slightly earlier alarm.',

      'Transit advocacy and personal buffers can coexist.',

    ],

    details: [

      'One unreliable transfer breaks a whole morning.',

      'Podcasts help. Sleep helps more.',

      'Cities feel different when you are not sealed in a car.',

      'I keep a light rain layer in my bag year-round now.',

      'The express bus only helps if I leave at the time I claim I will.',

      'I use the delay time to stretch instead of refreshing the app angrily.',

      'A coworker carpool cut costs and added a weekly check-in.',

      'I mapped a walking backup for when the train dies.',

      'Earplugs and a book beat rage-scrolling on the platform.',

      'I noticed which stations feel unsafe after dark and adjusted routes.',

      'Parking fees finally pushed me onto transit three days a week.',

      'Leaving a buffer made me less likely to punish the next person I meet.',

    ],

    lessons: [

      'Time is the real toll.',

      'Advocate for better transit and also pack a backup plan.',

      'A calmer arrival is worth a slightly earlier alarm.',

      'Your commute sets the tone for the first meeting.',

      'Systems fail. Personal buffers are kindness to yourself.',

      'Multimodal options increase resilience.',

      'Attention on the journey can be chosen, not only endured.',

      'Policy change and personal tactics both matter.',

      'Sleep debt makes every delay feel larger.',

      'Walk segments improve mood more than you expect.',

      'Reliability beats raw speed for daily life.',

      'Arrive as a person, not as residual traffic stress.',

    ],

  },

  gratitude: {

    hooks: [

      'Quick gratitude post because I have been bad at saying it out loud.',

      'Thank you to the people who make my work possible.',

      'I am ending the week naming specifics, not vibes.',

      'My manager covered a meeting so I could take my kid to the dentist.',

      'A coworker left clear notes that saved me an hour.',

      'Family handled dinner on the night I had nothing left.',

      'Gratitude note: specific thanks land harder than generic ones.',

      'I am saying it while people can still hear it.',

      'Someone held the door for a harder week than they knew.',

      'I wrote three thank-you messages before logging off.',

      'Appreciation update from someone who usually rushes past it.',

      'The quiet helpers deserve a public nod sometimes.',

    ],

    details: [

      'My manager covered a meeting so I could take my kid to the dentist.',

      'A coworker left clear notes that saved me an hour.',

      'Family handled dinner on the night I had nothing left.',

      'A barista remembered my order on a day I felt invisible.',

      'IT fixed my access issue without making me feel foolish.',

      'A mentor answered a short question that unblocked a long week.',

      'The night shift left the station ready for us. That is love in logistics.',

      'A neighbor took in a package and texted so I would not worry.',

      'My partner asked how the hard meeting went and actually listened.',

      'A student said thank you for the extra explanation. I needed that.',

      'Finance processed reimbursements fast enough to matter.',

      'Someone credited my idea in a meeting where I was not present.',

    ],

    lessons: [

      'Specific thanks land harder than generic ones.',

      'Gratitude is a practice, not a caption.',

      'Say it while people can still hear it.',

      'Notice the invisible work on purpose.',

      'Public credit costs nothing and builds culture.',

      'Write it down when you feel it, not when it is convenient.',

      'Gratitude without reciprocity can still be sincere. Follow through when you can.',

      'Small acknowledgments change whether people stay.',

      'Name the behavior, not only the person.',

      'End-of-week thanks reset the story you tell about your life.',

      'Appreciation is maintenance for relationships.',

      'Being grateful and being ambitious are compatible.',

    ],

  },

};



const LIST_ITEMS = {

  workplace: [

    'Write the decision and the owner in the same place.',

    'Confirm dates before you celebrate alignment.',

    'Follow up once in writing, then move on.',

    'Share the why, not just the what.',

    'Protect one block of focus time this week.',

    'Ask who is missing from the conversation.',

    'Replace a status meeting with a shared doc update.',

    'Name the tradeoff out loud before voting.',

    'Close the loop with anyone who was blocked.',

    'Put the definition of done above the task list.',

    'Invite the quiet expert before the loud meeting.',

    'Delete a recurring invite that no longer earns its slot.',

    'Capture risks in the same doc as the plan.',

    'Schedule the retro while the work is still warm.',

    'Separate brainstorming from decision time.',

  ],

  parenting: [

    'Put phones away for one stretch of the evening.',

    'Name the feeling before you fix the problem.',

    'Keep one routine boring on purpose.',

    'Ask what they need, not what you assume.',

    'Repair after you snap. Kids remember the repair.',

    'Protect a short walk or play block after pickup.',

    'Prep tomorrow\'s bag tonight to lower morning heat.',

    'Offer two acceptable choices instead of a lecture.',

    'Eat one meal without multitasking screens.',

    'Celebrate effort aloud when you see it.',

    'Read one chapter even on the tired nights.',

    'Leave five minutes of buffer before the next transition.',

  ],

  pets: [

    'Keep the walk even when the weather is annoying.',

    'Budget for the unexpected vet bill.',

    'Training reps beat long lectures.',

    'Celebrate tiny behavior wins.',

    'Schedule preventative care before the scare.',

    'Rotate enrichment so boredom does not invent hobbies.',

    'Practice calm greetings at the door.',

    'Keep a go-bag for emergency clinic nights.',

    'Short sessions with high clarity.',

    'Log food changes when stomachs get mysterious.',

    'Brush and nail care on a recurring calendar.',

    'End the day with unhurried pet time.',

  ],

  fitness: [

    'Schedule the session like a meeting.',

    'Prioritize sleep as part of training.',

    'Progressive overload, not hero days.',

    'Mobility counts as work.',

    'Lay out clothes the night before.',

    'Track only one primary metric for a month.',

    'Finish the warm-up before you negotiate.',

    'Walk after meals when you can.',

    'Deload before your body forces a break.',

    'Hydrate like it affects the next set, because it does.',

    'Choose a program you can finish on a busy week.',

    'Text an accountability partner when you leave the gym.',

  ],

  personal_finance: [

    'Automate the boring transfers.',

    'Review subscriptions once a quarter.',

    'Name every sinking fund.',

    'Talk numbers without assigning blame.',

    'Open the statements on the first of the month.',

    'Give every dollar a job, including fun money.',

    'Build a one-month buffer before optimizing yield.',

    'Negotiate one bill this quarter.',

    'Separate bills, spending, and savings accounts.',

    'Track cash spending for two weeks honestly.',

    'Set calendar reminders for annual renewals.',

    'Agree on a decision rule for purchases over a set amount.',

  ],

  remote_work: [

    'Write the decision before you book the call.',

    'Publish response-time norms by channel.',

    'Protect a daily shutdown ritual.',

    'Keep a living FAQ for new hires.',

    'Block focus time across time zones intentionally.',

    'Default status updates to async docs.',

    'Take lunch away from the keyboard.',

    'Record optional meetings for other zones.',

    'Turn off non-on-call badges after hours.',

    'Start the week with a short written plan.',

    'Separate work and personal browser profiles.',

    'Walk outside between back-to-back calls.',

  ],

  customer_experience: [

    'Give a concrete ETA instead of "soon."',

    'Apologize with the next step attached.',

    'Route urgency to humans; leave FAQs to bots.',

    'Rewrite one help article from a confused customer\'s eyes.',

    'Log the top complaints and pick three root fixes.',

    'Call when the thread is emotional.',

    'Publish status before people have to ask.',

    'Train listening first, script second.',

    'Measure silence as carefully as reply time.',

    'Credit the frontline insight in the roadmap.',

    'Make the refund path obvious and fast.',

    'Close with a confirmation of what happens next.',

  ],

  small_business: [

    'Track which offerings actually pay rent.',

    'Batch admin on one protected day.',

    'Write the opening checklist so anyone can run it.',

    'Ask for the review while the smile is fresh.',

    'Price for sustainability, not applause.',

    'Call three past customers with no pitch.',

    'Cut SKUs that only feed ego.',

    'Document refunds before arguments start.',

    'Close at a humane hour on purpose.',

    'Train one helpful upsell, not ten pushy ones.',

    'Review cash timing weekly, not only P&L.',

    'Hire for trust, then train the craft.',

  ],

  ai_at_work: [

    'Use AI for drafts, humans for judgment.',

    'Never paste confidential data into public tools.',

    'Label AI-assisted work for reviewers.',

    'Verify citations before they leave the building.',

    'Ask the model to show uncertainty.',

    'Rewrite outputs in your own voice before shipping.',

    'Log where AI saved time and where it created rework.',

    'Teach evaluation skills, not only prompt tricks.',

    'Keep a short team AI use policy visible.',

    'Compare two prompts before trusting the first answer.',

    'Reserve strategy calls for humans with context.',

    'Treat speed gains as review time, not skip-review time.',

  ],

  education: [

    'Block study hours like client work.',

    'Ask the basic question in the first week.',

    'Rewrite messy notes within 24 hours.',

    'Go to office hours once, then again.',

    'Explain the concept out loud to an empty room.',

    'Join the cohort chat and actually participate.',

    'Cut one lower priority to fund learning time.',

    'Use flashcards on the commute.',

    'Highlight syllabus deadlines like a project plan.',

    'Teach back one idea to a friend each week.',

    'Protect sleep during exam stretches.',

    'Choose stretch electives on purpose.',

  ],

  teaching: [

    'Greet students at the door.',

    'Plan transitions as carefully as content.',

    'Use exit tickets to see what landed.',

    'Lead parent notes with specifics and care.',

    'Offer choice without quietly lowering the bar.',

    'Call home with a positive before any crisis.',

    'Revise rubrics until students can use them.',

    'Protect planning time like instruction time.',

    'Practice classroom norms, do not only post them.',

    'Try one PD idea the very next day.',

    'Repair privately after public friction.',

    'Celebrate curiosity aloud when it appears.',

  ],

  healthcare: [

    'Take the break your license needs.',

    'Hydrate between rooms on purpose.',

    'Document in real time when you can.',

    'Debrief tough cases without blame theater.',

    'Use plain language with families.',

    'Thank support staff by name.',

    'Flag near misses while they are fresh.',

    'Match assignments to acuity honestly.',

    'Cover a colleague\'s break and accept coverage back.',

    'Use PTO without apologizing for existing.',

    'Train new hires with clarity under pressure.',

    'Advocate upstream when staffing threatens safety.',

  ],

  startup: [

    'Talk to a user before polishing further.',

    'Write kill criteria before launching experiments.',

    'Review runway on a boring weekly cadence.',

    'Cut features nobody uses, even beloved ones.',

    'Keep decision logs for a small team.',

    'Separate founder feelings from customer evidence.',

    'Celebrate retention louder than vanity signups.',

    'Hire with scorecards, not vibes alone.',

    'Shrink scope until weekly shipping is honest.',

    'Turn support tickets into research.',

    'Block founder deep work before Slack opens.',

    'Simplify the pitch until the story is clear.',

  ],

  trades: [

    'Measure twice before you cut budget twice.',

    'Photograph before and after states.',

    'Leave the site cleaner than you found it.',

    'Call about surprises before they hit the invoice.',

    'Label shutoffs for the next person.',

    'Maintain tools on a Friday ritual.',

    'Bring the apprentice into the tricky step.',

    'Coordinate with other trades early.',

    'Write a short handoff note before leaving.',

    'Wear the safety gear without debate.',

    'Price honestly enough to sleep afterward.',

    'Teach one technique each job on purpose.',

  ],

  commute: [

    'Leave a buffer that survives one missed transfer.',

    'Pack a rain layer year-round.',

    'Use delay time to stretch, not rage-refresh.',

    'Map a walking backup route.',

    'Shift start time thirty minutes if the crush owns you.',

    'Keep earplugs and a book in the bag.',

    'Try a multimodal option one day a week.',

    'Hydrate before the long ride.',

    'Advocate for transit and keep a personal plan B.',

    'Protect sleep so delays hurt less.',

    'Walk a segment when weather allows.',

    'Arrive as a person, not as residual traffic.',

  ],

  food: [

    'Salt early and taste as you go.',

    'Prep one component on Sunday for Tuesday you.',

    'Keep a list of easy-win dinners for drained nights.',

    'Tip like you mean the recovery you received.',

    'Batch grains so lunches exist.',

    'Name leftovers so they feel intentional.',

    'Buy better oil and cheaper filler snacks.',

    'Ask the server what they actually like.',

    'Clean as you cook in small loops.',

    'Cook one cuisine for a month to build fluency.',

    'Share a meal before you optimize the week alone.',

    'Grocery-list before another delivery fee.',

  ],

  travel: [

    'Build a buffer day into the itinerary.',

    'Pack lighter than your anxiety suggests.',

    'Leave one afternoon empty on purpose.',

    'Book mid-morning flights when you can.',

    'Write three sentences each night.',

    'Walk outside on arrival day for jet lag.',

    'Prefer a local transit pass over stacked ride apps.',

    'Put the phone away for one museum hour.',

    'Choose one nicer outfit for the unexpected dinner.',

    'Photograph less, talk about what you saw more.',

    'Treat coming home as part of the trip.',

    'Ask locals where they actually eat.',

  ],

  sports: [

    'Celebrate hustle louder than highlight plays.',

    'Thank officials even when you disagree.',

    'Keep film review short and specific.',

    'Rotate playing time with intention.',

    'Pack water and logistics like a coordinator.',

    'Warm up like injuries are listening.',

    'Show up for midweek games.',

    'Process talk after losses, not character talk.',

    'Notice who changes the energy from the bench.',

    'Keep sideline behavior coachable.',

    'Protect rest days in the training plan.',

    'Let joy stay part of the sport.',

  ],

  community: [

    'Ask what is needed before announcing your plan.',

    'Show up to the unglamorous agenda items.',

    'Follow up in writing after the meeting.',

    'Translate materials so more households can join.',

    'Map who already does the work.',

    'Bring hospitality to long meetings.',

    'Credit quiet stewards publicly.',

    'Walk and talk when signatures matter.',

    'Keep disagreements about proposals, not people.',

    'Volunteer for a role that keeps lights on.',

    'Start a small shared resource on your block.',

    'Return next time. Belonging is repetition.',

  ],

  housing: [

    'Get three quotes before you commit.',

    'Budget a repair line that assumes breakage.',

    'Keep warranties and paint colors in one binder.',

    'Schedule HVAC before peak-season panic.',

    'Photograph serial numbers ahead of support calls.',

    'Label the breaker panel like an adult.',

    'Fix small moisture issues early.',

    'Ask neighbors before buying every tool.',

    'Negotiate renewals with comps in hand.',

    'Know when DIY is ego versus savings.',

    'Clear moving clutter that taxes your calm.',

    'Document issues before they become arguments.',

  ],

  family: [

    'Call without an agenda once this week.',

    'Check on the quiet relative.',

    'Share a calendar for gatherings.',

    'Relieve the person who always organizes.',

    'Send an ordinary photo, not only milestones.',

    'Apologize for the sharp comment while it still matters.',

    'Ask an elder for a story from before you.',

    'Divide hosting tasks in writing.',

    'Practice a short no without an essay.',

    'Keep one simple tradition alive.',

    'Mail a note that will not vanish in a thread.',

    'Lead with repair when being right is tempting.',

  ],

  volunteering: [

    'Sign up for a recurring shift, not only a splash day.',

    'Ask what skills are scarce.',

    'Follow intake process instead of improvising help.',

    'Stay for cleanup.',

    'Put the next date on your calendar before leaving.',

    'Invite one friend with you.',

    'Listen before redesigning the system.',

    'Give time when money is tight.',

    'Thank coordinators by name.',

    'Label and stage so the next shift inherits order.',

    'Prioritize dignity in every interaction.',

    'Choose local problems you can touch.',

  ],

  promotion: [

    'Ask what success looks like at 90 days.',

    'Schedule listening tours before grand plans.',

    'Document how decisions will get made.',

    'Thank private advocates privately.',

    'Negotiate clarity as well as compensation.',

    'Inherit the backlog with triage, not heroics.',

    'Keep doing the work you already know well.',

    'Invite feedback early while it is cheap.',

    'Share the milestone so others can see the path.',

    'Separate title pride from scope reality.',

    'Mentor two people as you rise.',

    'Write down doubts, then act anyway.',

  ],

  career_advice: [

    'Keep a weekly brag doc.',

    'Ask for success criteria before starting.',

    'Protect one skill block on the calendar.',

    'Request feedback while the project is warm.',

    'Say no to low-leverage work on purpose.',

    'Propose a scoped experiment instead of waiting.',

    'Help three people before asking for a favor.',

    'Shadow someone for a day.',

    'Track outcomes, not only hours.',

    'Choose managers who develop people.',

    'Leave clear handoffs as part of your reputation.',

    'Recover as intentionally as you strive.',

  ],

  gratitude: [

    'Name the specific behavior you appreciated.',

    'Thank someone while they can still hear it.',

    'Send three notes before you log off Friday.',

    'Credit people in rooms they are not in.',

    'Notice invisible logistics work.',

    'Say it out loud, not only in your head.',

    'Write gratitude when you feel it, not later.',

    'Publicly nod to quiet helpers.',

    'Follow appreciation with a reciprocal help offer.',

    'End the week with specifics, not vibes.',

    'Tell a manager about someone\'s good work.',

    'Keep a running list of people to thank.',

  ],

  default: [

    'Start smaller than you think you need to.',

    'Say the quiet constraint out loud.',

    'Check in before you escalate.',

    'Leave a note for future you.',

    'Ask one clarifying question early.',

    'Close the loop when you are done.',

    'Trade perfect for finished when time is short.',

    'Thank the person who made it easier.',

    'Write the next action before you walk away.',

    'Reduce one source of friction this week.',

    'Prefer clear over clever.',

    'Return to the basics when complexity spikes.',

  ],

};



const FILLERS_BY_TOPIC = {

  workplace: [

    'I keep noticing how unclear ownership creates polite delays.',

    'None of this requires a new framework, just follow-through.',

    'I am writing it down so the next busy week cannot erase it.',

  ],

  parenting: [

    'The house does not need to be impressive. It needs to be steady.',

    'I am measuring the day by connection, not by completed chores.',

    'Most of the useful parenting advice is inconvenient and true.',

  ],

  personal_finance: [

    'Calm money is usually dull money, and that is fine.',

    'I care more about fewer surprises than clever optimization.',

    'The spreadsheet is only useful if we look at it together.',

  ],

  fitness: [

    'The unremarkable weeks are doing most of the work.',

    'I am optimizing for showing up, not for impressive screenshots.',

    'Logistics beat motivation speeches in my actual life.',

  ],

  remote_work: [

    'Async only works when people can find the decision later.',

    'I had to rebuild the buffer the commute used to give me.',

    'Availability theater helps no one across time zones.',

  ],

  ai_at_work: [

    'The tool is fast. The standards still belong to us.',

    'I would rather be slow and accountable than quick and vague.',

    'Judgment is the scarce resource, not typing speed.',

  ],

  default: [

    'I keep coming back to how small choices compound over a quarter.',

    'None of this is revolutionary, but repeating the basics still helps.',

    'Context for anyone reading along: this is from my lane, not a universal rule.',

    'I wrote this down so I would not forget it the next time things get busy.',

    'If this is useful to one person nearby, it was worth posting.',

    'Happy to compare notes with people doing similar work in other places.',

    'The details will differ by context, but the pattern keeps showing up.',

    'I am naming this publicly because private complaints rarely change systems.',

    'Still figuring out the balance, and that is part of why I am sharing.',

    'This is less a hot take and more a reminder to myself.',

    'I might be wrong about the edges, but the center feels solid.',

    'Sharing from experience, not from a pedestal.',

  ],

};



const TRYHARD_CLOSERS = [

  'Agree?',

  'Thoughts?',

  'Would love to hear how others handle this.',

  'Curious what you would have done.',

];



const NORMAL_CLOSERS = [

  'That is where I am landing today.',

  'Still learning.',

  'Onward.',

  'Grateful for the reminder.',

  'Back to it.',

  'Just wanted to put this somewhere.',

  'More soon.',

  'Leaving this here for now.',

  'Taking it one honest step at a time.',

  'That is the update from here.',

];



const QUOTE_BANK = [

  `"Can we move the deadline?"`,

  `"I thought someone else owned this."`,

  `"Is this urgent or just loud?"`,

  `"Thanks for flagging — what do you need from me?"`,

  `"Can you send a quick summary after?"`,

  `"Who owns the next step?"`,

  `"I am not blocked. I am unclear."`,

  `"What does good look like by Friday?"`,

];



const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];



function listForTopic(topic) {

  return LIST_ITEMS[topic] || LIST_ITEMS.default;

}



function fillersForTopic(topic) {

  return [...(FILLERS_BY_TOPIC[topic] || []), ...FILLERS_BY_TOPIC.default];

}



function wordCount(text) {

  return text.split(/\s+/).filter(Boolean).length;

}



function trimToMax(text, max) {

  const words = text.split(/\s+/).filter(Boolean);

  if (words.length <= max) return text;

  return `${words.slice(0, max).join(' ')}`;

}



function shuffleLocal(rng, arr) {

  const a = arr.slice();

  for (let i = a.length - 1; i > 0; i--) {

    const j = Math.floor(rng() * (i + 1));

    [a[i], a[j]] = [a[j], a[i]];

  }

  return a;

}



function cityLine(rng) {

  return pick(rng, CITIES);

}



function ensureUsed(used) {

  if (!used) return { sentences: new Set(), hooks: new Set(), fillers: new Set() };

  if (!used.sentences) used.sentences = new Set();

  if (!used.hooks) used.hooks = new Set();

  if (!used.fillers) used.fillers = new Set();

  return used;

}



/** Prefer unused lines; fall back only when the pool is exhausted. */

function pickFresh(rng, pool, usedSet, mark = true) {

  const unused = pool.filter((x) => !usedSet.has(x));

  const choice = unused.length ? pick(rng, unused) : pick(rng, pool);

  if (mark) usedSet.add(choice);

  return choice;

}



function pickBeat(rng, pool, used) {

  return pickFresh(rng, pool, used.sentences, true);

}



function pickHook(rng, pool, used) {

  const unused = pool.filter((x) => !used.hooks.has(x) && !used.sentences.has(x));

  const choice = unused.length

    ? pick(rng, unused)

    : pickFresh(rng, pool, used.sentences, false);

  used.hooks.add(choice);

  used.sentences.add(choice);

  return choice;

}



function expandWithLists(body, rng, need, topic, usedInPost) {

  const pool = shuffleLocal(rng, [...listForTopic(topic), ...LIST_ITEMS.default]);

  const wanted = Math.min(7, Math.max(3, Math.ceil(need / 12)));

  const items = [];

  for (const x of pool) {

    if (usedInPost.has(x)) continue;

    items.push(x);

    usedInPost.add(x);

    if (items.length >= wanted) break;

  }

  while (items.length < Math.min(3, pool.length)) {

    const x = pool[items.length % pool.length];

    if (!items.includes(x)) items.push(x);

    else break;

  }

  const list = items.map((x, i) => `${i + 1}. ${x}`).join('\n');

  return body ? `${body}\n\n${list}` : list;

}



function voiceAdjust(text, voice, rng) {

  if (voice === 'casual_online') {

    return text

      .replace(/\bI am\b/g, () => (rng() < 0.5 ? "I'm" : 'I am'))

      .replace(/\bWe are\b/g, () => (rng() < 0.4 ? "We're" : 'We are'));

  }

  if (voice === 'hr_formal') {

    return text.replace(/\bgot\b/gi, 'received').replace(/\bkid\b/gi, 'child');

  }

  if (voice === 'warm_gratitude' && !/grateful|thank/i.test(text)) {

    return `${text}\n\nTruly grateful.`;

  }

  return text;

}



function pickFiller(rng, topic, used, usedInPost) {

  const pool = fillersForTopic(topic);

  const unused = pool.filter((x) => !used.fillers.has(x) && !usedInPost.has(x));

  const choice = unused.length ? pick(rng, unused) : pick(rng, pool.filter((x) => !usedInPost.has(x)).concat(pool));

  used.fillers.add(choice);

  usedInPost.add(choice);

  return choice;

}



/**

 * Compose a body for topic/voice/structure aiming at [minW, maxW].

 * tryhard: mild engagement-bait closer (~20% of posts).

 * used: { sentences: Set, hooks: Set, fillers: Set } across the batch.

 */

export function composeBody({ topic, voice, structure, rng, minW, maxW, tryhard, company, name, used: usedIn }) {

  const used = ensureUsed(usedIn);

  const usedInPost = new Set();

  const pack = BEATS[topic] || BEATS.workplace;



  const hook = pickHook(rng, pack.hooks, used);

  let detail = pickBeat(rng, pack.details, used).replace(/\bthe team\b/i, () =>

    rng() < 0.3 ? `the team at ${company}` : 'the team',

  );

  usedInPost.add(detail);

  const lesson = pickBeat(rng, pack.lessons, used);

  usedInPost.add(lesson);

  usedInPost.add(hook);

  const closer = tryhard ? pick(rng, TRYHARD_CLOSERS) : pick(rng, NORMAL_CLOSERS);

  const first = name.split(' ')[0] || name;



  let body;

  switch (structure) {

    case 'short_update':

      body = `${hook} ${detail} ${closer}`;

      break;

    case 'story_lesson':

      body = `${hook}\n\n${detail}\n\n${lesson}\n\n${closer}`;

      break;

    case 'short_list':

      body = `${hook}\n\n${expandWithLists(detail, rng, maxW, topic, usedInPost)}\n\n${lesson}`;

      break;

    case 'quote_reply': {

      const quote = pick(rng, QUOTE_BANK);

      body = `${hook}\n\nSomeone wrote:\n${quote}\n\nMy reply was basically: ${detail} ${lesson} ${closer}`;

      break;

    }

    case 'thread_beats': {

      const extra = pickBeat(rng, pack.details, used);

      usedInPost.add(extra);

      body = `1/ ${hook}\n\n2/ ${detail}\n\n3/ ${lesson}\n\n4/ ${extra}\n\n5/ ${closer}`;

      break;

    }

    case 'opinion_support':

      body = `${hook}\n\nI think ${lesson.charAt(0).toLowerCase()}${lesson.slice(1)}\n\nWhy: ${detail}\n\n${closer}`;

      break;

    case 'news_lede':

      body = `${hook}\n\nIn ${cityLine(rng)}, ${detail.charAt(0).toLowerCase()}${detail.slice(1)}\n\n${lesson}`;

      break;

    case 'before_after': {

      const before = pickBeat(rng, pack.details, used);

      usedInPost.add(before);

      body = `Before: ${before}\n\nAfter: ${detail}\n\n${lesson}\n\n${closer}`;

      break;

    }

    case 'open_letter':

      body = `To anyone juggling more than they admit:\n\n${hook} ${detail}\n\n${lesson}\n\n— ${first}\n\n${closer}`;

      break;

    case 'howto_steps':

      body = `${hook}\n\nHere is what helped me:\n${expandWithLists('', rng, maxW, topic, usedInPost)}\n\n${lesson}\n\n${closer}`;

      break;

    case 'qa_self_interview': {

      const d2 = pickBeat(rng, pack.details, used);

      usedInPost.add(d2);

      body = `Q: What is going on?\nA: ${hook}\n\nQ: What actually happened?\nA: ${detail}\n\nQ: What are you taking from it?\nA: ${lesson}\n\nQ: Anything else?\nA: ${d2} ${closer}`;

      break;

    }

    case 'timeline_week': {

      const extras = [detail, lesson];

      while (extras.length < 5) {

        const pool = extras.length % 2 === 0 ? pack.details : pack.lessons;

        const line = pickBeat(rng, pool, used);

        if (!extras.includes(line)) extras.push(line);

        else extras.push(pick(rng, pool));

      }

      body = WEEKDAYS.map((day, i) => `${day}: ${extras[i]}`).join('\n\n') + `\n\n${closer}`;

      break;

    }

    case 'myth_vs_reality': {

      const myth = pickBeat(rng, pack.hooks, used);

      body = `Myth: ${myth}\n\nReality: ${detail}\n\nWhat I am doing instead: ${lesson}\n\n${closer}`;

      break;

    }

    case 'email_forward': {

      const subject = hook.replace(/\.$/, '');

      body = `Forwarded conversation\nSubject: ${subject}\n\n---\n\n${detail}\n\n---\n\nMy note to the thread: ${lesson}\n\n${closer}`;

      break;

    }

    case 'metrics_then_human': {

      const metric = pickBeat(rng, pack.details, used);

      usedInPost.add(metric);

      body = `The metric: ${metric}\n\nThe human part: ${detail}\n\n${lesson}\n\n${hook}\n\n${closer}`;

      break;

    }

    case 'two_voices': {

      const past = pickBeat(rng, pack.details, used);

      usedInPost.add(past);

      body = `I used to: ${past}\n\nNow I: ${detail}\n\n${lesson}\n\n${hook}\n\n${closer}`;

      break;

    }

    default:

      body = `${hook}\n\n${detail}\n\n${lesson}\n\n${closer}`;

  }



  body = voiceAdjust(body, voice, rng).replace(/\n{3,}/g, '\n\n').trim();



  let guard = 0;

  const listStructures = new Set(['short_list', 'howto_steps']);

  while (wordCount(body) < minW && guard++ < 24) {

    if (listStructures.has(structure) && guard <= 4) {

      body = `${body}\n${expandWithLists('Also:', rng, Math.max(40, minW - wordCount(body)), topic, usedInPost)}`;

    } else if (guard % 3 === 0) {

      body = `${body}\n\n${pickFiller(rng, topic, used, usedInPost)}`;

    } else {

      const extra = pickBeat(rng, pack.details, used);

      const extraLesson = pickBeat(rng, pack.lessons, used);

      if (usedInPost.has(extra) && usedInPost.has(extraLesson)) {

        body = `${body}\n\n${pickFiller(rng, topic, used, usedInPost)}`;

      } else {

        usedInPost.add(extra);

        usedInPost.add(extraLesson);

        body = `${body}\n\n${extra}\n\n${extraLesson}`;

      }

    }

    body = body.replace(/\n{3,}/g, '\n\n').trim();

  }



  if (wordCount(body) > maxW) body = trimToMax(body, maxW);



  guard = 0;

  while (wordCount(body) < minW && guard++ < 12) {

    body = `${body} ${pickFiller(rng, topic, used, usedInPost)}`;

  }

  if (wordCount(body) > maxW) body = trimToMax(body, maxW);



  return body.trim();

}



export function firstNWords(text, n = 8) {

  return text.split(/\s+/).filter(Boolean).slice(0, n).join(' ').toLowerCase();

}



export function normalizeForNgrams(text) {

  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

}



export function extractNgrams(text, n = 4) {

  const words = normalizeForNgrams(text).split(' ').filter(Boolean);

  const grams = new Set();

  for (let i = 0; i <= words.length - n; i++) {

    grams.add(words.slice(i, i + n).join(' '));

  }

  return grams;

}



export function sharesNgram(text, existingGrams, n = 4) {

  const grams = extractNgrams(text, n);

  for (const g of grams) {

    if (existingGrams.has(g)) return true;

  }

  return false;

}



export { wordCount, TRYHARD_CLOSERS, BEATS };


