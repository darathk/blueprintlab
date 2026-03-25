'use client';

import { useState, useRef, useEffect, useMemo } from 'react';

const EMOJI_KEYWORDS: Record<string, string> = {
    // Smileys
    '😀': 'grin happy', '😃': 'smile happy', '😄': 'laugh happy smile', '😁': 'grin beam teeth',
    '😆': 'laugh squint haha', '😅': 'sweat laugh nervous', '🤣': 'rofl rolling lmao',
    '😂': 'joy cry laugh tears lol', '🙂': 'slight smile', '😊': 'blush happy warm',
    '😇': 'angel halo innocent', '🥰': 'love hearts adore', '😍': 'heart eyes love omg',
    '🤩': 'star struck wow amazing', '😘': 'kiss blow love', '😗': 'kiss whistle',
    '😚': 'kiss blush shy', '😙': 'kiss smile', '🥲': 'sad smile cry bittersweet',
    '😋': 'yum delicious tongue tasty', '😛': 'tongue out playful', '😜': 'wink tongue silly',
    '🤪': 'crazy zany wild goofy', '😝': 'tongue squint bleh', '🤑': 'money rich dollar',
    '🤗': 'hug hugging warm', '🤭': 'giggle hand mouth oops', '🤫': 'shush quiet secret',
    '🤔': 'think thinking hmm wonder', '🫡': 'salute respect sir', '🤐': 'zip mouth quiet secret',
    '🤨': 'raised eyebrow skeptical sus', '😐': 'neutral blank meh', '😑': 'expressionless flat',
    '😶': 'no mouth silent speechless', '🫥': 'dotted line invisible', '😏': 'smirk sly suggestive',
    '😒': 'unamused annoyed meh', '🙄': 'eye roll whatever', '😬': 'grimace awkward yikes',
    '🤥': 'lying pinocchio', '🫨': 'shaking vibrate', '😌': 'relieved peaceful content',
    '😔': 'pensive sad thoughtful', '😪': 'sleepy tired drool', '🤤': 'drool hungry',
    '😴': 'sleep zzz nap tired', '😷': 'mask sick medical covid', '🤒': 'sick thermometer fever',
    '🤕': 'hurt bandage injury', '🤢': 'nauseous sick green', '🤮': 'vomit puke sick throw up',
    '🥵': 'hot sweat heat', '🥶': 'cold freezing ice', '🥴': 'woozy drunk dizzy',
    '😵': 'dizzy spiral knocked out', '🤯': 'mind blown explode shocked', '🤠': 'cowboy yeehaw',
    '🥳': 'party celebrate birthday', '🥸': 'disguise incognito fake', '😎': 'cool sunglasses awesome',
    '🤓': 'nerd glasses geek smart', '🧐': 'monocle detective inspect', '😕': 'confused unsure',
    '🫤': 'diagonal mouth meh uncertain', '😟': 'worried concerned', '🙁': 'frown sad slight',
    '😮': 'open mouth wow surprised oh', '😯': 'hushed surprised quiet', '😲': 'astonished shocked wow',
    '😳': 'flushed embarrassed blush red', '🥺': 'pleading puppy eyes please cute',
    '🥹': 'hold back tears emotional touched', '😦': 'frown open worried',
    '😧': 'anguished worried stressed', '😨': 'fearful scared afraid', '😰': 'anxious sweat nervous',
    '😥': 'sad relieved phew', '😢': 'cry sad tear upset', '😭': 'sob crying loud wail bawl',
    '😱': 'scream fear horror shocked', '😖': 'confounded frustrated', '😣': 'persevere struggle',
    '😞': 'disappointed sad let down', '😓': 'downcast sweat sad', '😩': 'weary tired exhausted',
    '😫': 'tired fatigued done', '🥱': 'yawn bored sleepy', '😤': 'huff angry triumph steam',
    '😡': 'rage angry mad furious red', '😠': 'angry mad upset grr',
    '🤬': 'swear curse angry symbols', '😈': 'devil smiling naughty evil', '👿': 'devil angry imp',
    '💀': 'skull dead death rip', '☠️': 'skull crossbones danger death poison',
    '💩': 'poop poo crap', '🤡': 'clown joker circus', '👹': 'ogre monster japanese',
    '👺': 'goblin tengu mask', '👻': 'ghost boo spooky halloween', '👽': 'alien ufo space',
    '👾': 'space invader game alien', '🤖': 'robot ai machine', '😺': 'cat smile happy',
    '😸': 'cat grin', '😹': 'cat joy tears', '😻': 'cat heart eyes love', '😼': 'cat wry smirk',
    '😽': 'cat kiss', '🙀': 'cat weary shocked', '😿': 'cat cry sad', '😾': 'cat pout angry',
    '🫶': 'heart hands love care', '🙈': 'see no evil monkey hide', '🙉': 'hear no evil monkey',
    '🙊': 'speak no evil monkey shh',
    // Gestures
    '👋': 'wave hello hi bye greeting', '🤚': 'raised back hand stop', '🖐️': 'hand fingers spread open',
    '✋': 'raised hand stop high five', '🖖': 'vulcan spock trek', '🫱': 'rightward hand',
    '🫲': 'leftward hand', '🫳': 'palm down hand', '🫴': 'palm up hand',
    '🫷': 'leftward pushing hand', '🫸': 'rightward pushing hand',
    '👌': 'ok okay perfect chef kiss', '🤌': 'pinched fingers italian', '🤏': 'pinching small tiny little',
    '✌️': 'peace victory two', '🤞': 'fingers crossed luck hope', '🫰': 'hand love index thumb',
    '🤟': 'love you sign ily', '🤘': 'rock metal horns', '🤙': 'call me hang loose shaka',
    '👈': 'point left pointing', '👉': 'point right pointing', '👆': 'point up',
    '🖕': 'middle finger rude', '👇': 'point down', '☝️': 'index up one',
    '🫵': 'index pointing you', '👍': 'thumbs up yes good like approve', '👎': 'thumbs down no bad dislike',
    '✊': 'fist raised power solidarity', '👊': 'fist bump punch', '🤛': 'left fist bump',
    '🤜': 'right fist bump', '👏': 'clap applause bravo', '🙌': 'raised hands celebration hooray praise',
    '👐': 'open hands hug', '🤲': 'palms up together', '🤝': 'handshake deal agreement',
    '🙏': 'pray please thank you folded hands namaste', '✍️': 'writing hand pen',
    '💅': 'nail polish manicure sassy', '🤳': 'selfie camera phone',
    '💪': 'muscle strong flex bicep arm strength fitness lift', '🦾': 'mechanical arm prosthetic robot',
    '🦿': 'mechanical leg prosthetic', '🦵': 'leg kick', '🦶': 'foot step',
    '👂': 'ear listen hear', '🦻': 'ear hearing aid', '👃': 'nose smell sniff',
    '👀': 'eyes look see watching', '👁️': 'eye see look', '👅': 'tongue lick taste',
    '👄': 'mouth lips kiss', '🫦': 'biting lip nervous flirty', '🧠': 'brain smart think mind',
    '🫀': 'anatomical heart organ', '🫁': 'lungs breathe', '🦷': 'tooth dentist',
    '🦴': 'bone skeleton', '👶': 'baby infant child', '🧒': 'child kid',
    '👦': 'boy male child', '👧': 'girl female child', '🧑': 'person adult',
    '👱': 'blond person hair', '👨': 'man male guy', '🧔': 'beard man facial hair',
    '👩': 'woman female girl lady',
    // Hearts
    '❤️': 'red heart love', '🧡': 'orange heart', '💛': 'yellow heart',
    '💚': 'green heart', '💙': 'blue heart', '💜': 'purple heart',
    '🖤': 'black heart dark', '🤍': 'white heart pure', '🤎': 'brown heart',
    '💔': 'broken heart sad', '❤️‍🔥': 'heart fire passion burning',
    '❤️‍🩹': 'mending heart healing', '❣️': 'heart exclamation love',
    '💕': 'two hearts love', '💞': 'revolving hearts love', '💓': 'beating heart love',
    '💗': 'growing heart love', '💖': 'sparkling heart love', '💘': 'cupid heart arrow love',
    '💝': 'heart ribbon gift love', '💟': 'heart decoration love', '♥️': 'heart suit love',
    '💋': 'kiss mark lips', '💌': 'love letter mail', '💐': 'bouquet flowers',
    '🌹': 'rose red flower love', '🥀': 'wilted flower dead rose', '🌺': 'hibiscus flower',
    '🌸': 'cherry blossom flower pink', '💮': 'white flower',
    // Fitness
    '🏋️': 'weightlifting gym lift heavy barbell', '🏋️‍♂️': 'man weightlifting gym',
    '🏋️‍♀️': 'woman weightlifting gym', '🤸': 'cartwheel gymnastics acrobat',
    '🤸‍♂️': 'man cartwheel gymnastics', '🤸‍♀️': 'woman cartwheel gymnastics',
    '⛹️': 'basketball person dribble bounce', '🏃': 'running run sprint jog cardio',
    '🏃‍♂️': 'man running sprint', '🏃‍♀️': 'woman running sprint',
    '🚴': 'cycling bike bicycle ride', '🚴‍♂️': 'man cycling bike', '🚴‍♀️': 'woman cycling bike',
    '🧘': 'yoga meditation zen stretch', '🧘‍♂️': 'man yoga meditation', '🧘‍♀️': 'woman yoga meditation',
    '🤾': 'handball sport throw', '🏊': 'swimming swim pool water', '🏊‍♂️': 'man swimming',
    '🏊‍♀️': 'woman swimming', '🤽': 'water polo swim', '🚣': 'rowing row boat',
    '🧗': 'climbing climb rock wall', '🧗‍♂️': 'man climbing', '🧗‍♀️': 'woman climbing',
    '🏇': 'horse racing jockey', '⛷️': 'skiing ski snow', '🏂': 'snowboarding snow',
    '🪂': 'parachute skydiving', '🏆': 'trophy winner champion cup gold',
    '🥇': 'gold medal first place winner', '🥈': 'silver medal second place',
    '🥉': 'bronze medal third place', '🏅': 'medal sports achievement', '🎖️': 'military medal honor',
    '🔥': 'fire hot lit flame heat trending', '💯': 'hundred perfect score complete',
    '⚡': 'lightning bolt zap power energy fast', '🎯': 'target bullseye dart direct hit goal',
    '✅': 'check done yes correct green', '🏃‍➡️': 'person running right forward',
    // Food
    '🍎': 'apple red fruit', '🍐': 'pear fruit green', '🍊': 'orange tangerine fruit',
    '🍋': 'lemon citrus sour', '🍌': 'banana fruit yellow', '🍉': 'watermelon melon fruit',
    '🍇': 'grapes fruit wine', '🍓': 'strawberry berry fruit', '🫐': 'blueberry berry fruit',
    '🍈': 'melon cantaloupe', '🍒': 'cherry cherries fruit', '🍑': 'peach fruit butt',
    '🥭': 'mango fruit tropical', '🍍': 'pineapple fruit tropical', '🥥': 'coconut tropical',
    '🥝': 'kiwi fruit green', '🍅': 'tomato red', '🍆': 'eggplant aubergine',
    '🥑': 'avocado guacamole', '🫛': 'pea pod bean green', '🥦': 'broccoli vegetable green',
    '🥬': 'leafy green lettuce kale', '🥒': 'cucumber pickle', '🌶️': 'hot pepper chili spicy',
    '🫑': 'bell pepper capsicum', '🌽': 'corn maize', '🥕': 'carrot orange vegetable',
    '🧄': 'garlic', '🧅': 'onion', '🫘': 'beans legume', '🥔': 'potato',
    '🍠': 'sweet potato yam', '🫚': 'ginger root', '🥐': 'croissant pastry french',
    '🍞': 'bread loaf toast', '🥖': 'baguette french bread', '🥨': 'pretzel',
    '🧀': 'cheese wedge', '🥚': 'egg', '🍳': 'cooking egg frying pan',
    '🧈': 'butter', '🥞': 'pancake breakfast stack', '🧇': 'waffle breakfast',
    '🥓': 'bacon meat breakfast', '🥩': 'steak meat red', '🍗': 'chicken leg drumstick',
    '🍖': 'meat bone rib', '🌭': 'hot dog sausage', '🍔': 'burger hamburger',
    '🍟': 'fries french fries chips', '🍕': 'pizza slice', '🫓': 'flatbread naan',
    '🥪': 'sandwich sub', '🥙': 'pita stuffed falafel', '🧆': 'falafel',
    '🌮': 'taco mexican', '🌯': 'burrito wrap', '🫔': 'tamale', '🥗': 'salad green healthy',
    '🫕': 'fondue cheese', '🍝': 'spaghetti pasta noodle', '🍜': 'ramen noodle soup',
    '🍲': 'pot food stew soup', '🍛': 'curry rice', '🍣': 'sushi japanese fish',
    '🍱': 'bento box japanese', '🥟': 'dumpling dim sum', '🍤': 'shrimp prawn fried',
    '🍙': 'rice ball onigiri', '🍚': 'rice bowl', '🍘': 'rice cracker',
    '🍥': 'fish cake narutomaki', '🥮': 'moon cake', '🍢': 'oden skewer',
    '🍡': 'dango sweet japanese', '🍧': 'shaved ice dessert', '🍨': 'ice cream sundae',
    '🍦': 'ice cream cone soft serve', '🥧': 'pie dessert', '🧁': 'cupcake cake',
    '🍰': 'cake shortcake slice', '🎂': 'birthday cake celebrate', '🍮': 'custard pudding flan',
    '🍭': 'lollipop candy sweet', '🍬': 'candy sweet wrapper', '🍫': 'chocolate bar',
    '🍿': 'popcorn movie snack', '🍩': 'donut doughnut', '🍪': 'cookie biscuit',
    '🌰': 'chestnut nut',
    // Animals
    '🐶': 'dog puppy woof', '🐱': 'cat kitten meow', '🐭': 'mouse rat',
    '🐹': 'hamster gerbil', '🐰': 'rabbit bunny', '🦊': 'fox', '🐻': 'bear grizzly',
    '🐼': 'panda bear', '🐻‍❄️': 'polar bear arctic', '🐨': 'koala',
    '🐯': 'tiger face', '🦁': 'lion king jungle', '🐮': 'cow face moo',
    '🐷': 'pig face oink', '🐸': 'frog toad ribbit', '🐵': 'monkey face',
    '🐒': 'monkey ape', '🐔': 'chicken hen rooster', '🐧': 'penguin arctic',
    '🐦': 'bird tweet', '🐤': 'baby chick', '🐣': 'hatching chick egg', '🐥': 'front facing chick',
    '🦆': 'duck quack', '🦅': 'eagle bird prey', '🦉': 'owl hoot night', '🦇': 'bat vampire',
    '🐺': 'wolf howl', '🐗': 'boar pig wild', '🐴': 'horse pony', '🦄': 'unicorn magic rainbow',
    '🐝': 'bee bumble honey buzz', '🪱': 'worm', '🐛': 'bug caterpillar larva', '🦋': 'butterfly',
    '🐌': 'snail slow', '🐞': 'ladybug beetle', '🐜': 'ant insect', '🪰': 'fly insect buzz',
    '🪲': 'beetle bug', '🪳': 'cockroach roach', '🦟': 'mosquito bite',
    '🦗': 'cricket grasshopper', '🕷️': 'spider web', '🦂': 'scorpion sting',
    '🐢': 'turtle tortoise slow', '🐍': 'snake reptile', '🦎': 'lizard gecko reptile',
    '🦖': 'dinosaur t-rex trex', '🦕': 'dinosaur sauropod brontosaurus',
    '🐙': 'octopus tentacle', '🦑': 'squid tentacle', '🦐': 'shrimp prawn',
    '🦞': 'lobster crab seafood', '🦀': 'crab pinch', '🐡': 'puffer fish blowfish',
    '🐠': 'tropical fish', '🐟': 'fish', '🐬': 'dolphin flipper', '🐳': 'whale water spout',
    '🐋': 'whale blue ocean', '🦈': 'shark jaws', '🐊': 'crocodile alligator',
    '🐅': 'tiger stripes', '🐆': 'leopard spots cheetah', '🦓': 'zebra stripes',
    '🦍': 'gorilla ape', '🦧': 'orangutan ape', '🦣': 'mammoth woolly',
    '🐘': 'elephant trunk', '🦛': 'hippo hippopotamus', '🦏': 'rhino rhinoceros',
    '🐪': 'camel one hump', '🐫': 'camel two humps', '🦒': 'giraffe tall spots',
    '🦘': 'kangaroo joey hop', '🦬': 'bison buffalo',
    // Objects & Sports
    '⚽': 'soccer football ball kick', '🏀': 'basketball ball hoop dunk', '🏈': 'football american ball',
    '⚾': 'baseball ball', '🥎': 'softball ball', '🎾': 'tennis ball racket',
    '🏐': 'volleyball ball', '🏉': 'rugby ball', '🥏': 'frisbee disc',
    '🎱': 'billiards pool eight ball', '🪀': 'yo-yo toy', '🏓': 'ping pong table tennis paddle',
    '🏸': 'badminton shuttlecock', '🏒': 'ice hockey stick puck', '🏑': 'field hockey stick',
    '🥍': 'lacrosse stick', '🏏': 'cricket bat', '🥅': 'goal net',
    '⛳': 'golf flag hole', '🪁': 'kite flying', '🎣': 'fishing rod hook',
    '🤿': 'diving mask snorkel scuba', '🎽': 'running shirt jersey', '🎿': 'ski skiing',
    '🛷': 'sled toboggan', '🥌': 'curling stone', '🎮': 'gaming controller video game joystick',
    '🕹️': 'joystick arcade game', '🎲': 'dice game random', '🧩': 'puzzle piece jigsaw',
    '🎭': 'theater masks drama comedy', '🎨': 'art palette paint', '🎬': 'clapper board movie film',
    '🎤': 'microphone sing karaoke', '🎧': 'headphone headset music listen', '🎼': 'music score notes',
    '🎹': 'piano keys keyboard music', '🥁': 'drum percussion beat', '🎷': 'saxophone sax jazz',
    '🎺': 'trumpet horn brass', '🪗': 'accordion instrument', '🎸': 'guitar rock music',
    '🪕': 'banjo country music', '🎻': 'violin fiddle string', '💊': 'pill medicine drug capsule',
    '🩹': 'bandage adhesive band-aid', '🩺': 'stethoscope doctor medical',
    '🩻': 'x-ray skeleton scan', '🧬': 'dna science genetics', '🔬': 'microscope science lab',
    '🔭': 'telescope astronomy space stars', '📡': 'satellite antenna signal',
    '💻': 'laptop computer work', '🖥️': 'desktop computer screen monitor',
    '🖨️': 'printer print', '📱': 'phone mobile cell smartphone', '📲': 'call phone incoming',
    '☎️': 'telephone landline', '📞': 'phone receiver call', '💡': 'light bulb idea bright',
    // Symbols
    '💥': 'boom explosion pow crash', '💫': 'dizzy star orbit', '🎉': 'party popper tada celebrate confetti',
    '🎊': 'confetti ball celebrate', '🎈': 'balloon party birthday', '🎁': 'gift present wrapped box',
    '🎀': 'ribbon bow pink', '🏷️': 'label tag price', '💰': 'money bag rich cash',
    '💵': 'dollar bill money cash', '💸': 'money wings flying spending',
    '❌': 'cross no wrong delete', '❓': 'question mark red', '❗': 'exclamation mark important',
    '‼️': 'double exclamation important', '⁉️': 'exclamation question interrobang',
    '💤': 'sleep zzz snore', '💬': 'speech bubble chat message', '👁️‍🗨️': 'eye speech witness',
    '🗨️': 'left speech bubble talk', '💭': 'thought bubble think cloud',
    '🔔': 'bell notification alert ring', '🔕': 'bell mute silent no notification',
    '🎵': 'music note single melody', '🎶': 'music notes double melody',
    '🔊': 'speaker loud volume', '📢': 'loudspeaker announcement megaphone',
    '📣': 'megaphone cheering', '🔈': 'speaker low volume', '🔉': 'speaker medium',
    '🔇': 'speaker mute silent', '⏰': 'alarm clock time wake', '⏱️': 'stopwatch timer',
    '⏲️': 'timer clock', '🕐': 'one o clock time', '♻️': 'recycle green environment',
    '✝️': 'cross latin christian', '☪️': 'star crescent islam', '🕉️': 'om hindu',
    '☸️': 'wheel of dharma buddhism', '✡️': 'star of david jewish', '🔯': 'dotted star',
    '🕎': 'menorah jewish', '☯️': 'yin yang balance', '☮️': 'peace symbol',
    '🛐': 'place of worship pray', '⛎': 'ophiuchus zodiac',
    '♈': 'aries zodiac', '♉': 'taurus zodiac', '♊': 'gemini zodiac',
    '♋': 'cancer zodiac', '♌': 'leo zodiac', '♍': 'virgo zodiac',
    '♎': 'libra zodiac', '♏': 'scorpio zodiac', '♐': 'sagittarius zodiac',
    '♑': 'capricorn zodiac', '♒': 'aquarius zodiac', '♓': 'pisces zodiac',
    '🆔': 'id identification', '⚛️': 'atom science physics', '🆗': 'ok button',
    '🆕': 'new button fresh', '🌟': 'glowing star bright light',
    // Flags
    '🏁': 'checkered flag racing finish', '🚩': 'red flag warning triangular',
    '🎌': 'crossed flags japanese', '🏴': 'black flag pirate',
    '🏳️': 'white flag surrender', '🏳️‍🌈': 'rainbow flag pride lgbtq',
    '🏳️‍⚧️': 'transgender flag pride', '🏴‍☠️': 'pirate flag jolly roger skull',
    '🇺🇸': 'usa america united states', '🇬🇧': 'uk britain england',
    '🇨🇦': 'canada maple', '🇦🇺': 'australia', '🇩🇪': 'germany german',
    '🇫🇷': 'france french', '🇮🇹': 'italy italian', '🇪🇸': 'spain spanish',
    '🇧🇷': 'brazil brazilian', '🇲🇽': 'mexico mexican', '🇯🇵': 'japan japanese',
    '🇰🇷': 'korea korean south', '🇨🇳': 'china chinese', '🇮🇳': 'india indian',
    '🇷🇺': 'russia russian', '🇿🇦': 'south africa', '🇳🇬': 'nigeria nigerian',
    '🇪🇬': 'egypt egyptian', '🇦🇷': 'argentina', '🇨🇴': 'colombia',
    '🇵🇪': 'peru', '🇨🇱': 'chile', '🇻🇪': 'venezuela', '🇵🇹': 'portugal portuguese',
    '🇳🇱': 'netherlands dutch holland', '🇧🇪': 'belgium', '🇸🇪': 'sweden swedish',
    '🇳🇴': 'norway norwegian', '🇩🇰': 'denmark danish', '🇫🇮': 'finland finnish',
    '🇮🇪': 'ireland irish', '🇵🇱': 'poland polish',
};

const EMOJI_CATEGORIES: { name: string; icon: string; emojis: string[] }[] = [
    {
        name: 'Smileys',
        icon: '😀',
        emojis: [
            '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '😊',
            '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '🥲', '😋',
            '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🫡',
            '🤐', '🤨', '😐', '😑', '😶', '🫥', '😏', '😒', '🙄', '😬',
            '🤥', '🫨', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕',
            '🤢', '🤮', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '🥸',
            '😎', '🤓', '🧐', '😕', '🫤', '😟', '🙁', '😮', '😯', '😲',
            '😳', '🥺', '🥹', '😦', '😧', '😨', '😰', '😥', '😢', '😭',
            '😱', '😖', '😣', '😞', '😓', '😩', '😫', '🥱', '😤', '😡',
            '😠', '🤬', '😈', '👿', '💀', '☠️', '💩', '🤡', '👹', '👺',
            '👻', '👽', '👾', '🤖', '😺', '😸', '😹', '😻', '😼', '😽',
            '🙀', '😿', '😾', '🫶', '🙈', '🙉', '🙊',
        ]
    },
    {
        name: 'Gestures',
        icon: '👋',
        emojis: [
            '👋', '🤚', '🖐️', '✋', '🖖', '🫱', '🫲', '🫳', '🫴', '🫷',
            '🫸', '👌', '🤌', '🤏', '✌️', '🤞', '🫰', '🤟', '🤘', '🤙',
            '👈', '👉', '👆', '🖕', '👇', '☝️', '🫵', '👍', '👎', '✊',
            '👊', '🤛', '🤜', '👏', '🙌', '🫶', '👐', '🤲', '🤝', '🙏',
            '✍️', '💅', '🤳', '💪', '🦾', '🦿', '🦵', '🦶', '👂', '🦻',
            '👃', '👀', '👁️', '👅', '👄', '🫦', '🧠', '🫀', '🫁', '🦷',
            '🦴', '👶', '🧒', '👦', '👧', '🧑', '👱', '👨', '🧔', '👩',
        ]
    },
    {
        name: 'Hearts',
        icon: '❤️',
        emojis: [
            '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔',
            '❤️‍🔥', '❤️‍🩹', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝',
            '💟', '♥️', '💋', '💌', '💐', '🌹', '🥀', '🌺', '🌸', '💮',
        ]
    },
    {
        name: 'Fitness',
        icon: '💪',
        emojis: [
            '💪', '🏋️', '🏋️‍♂️', '🏋️‍♀️', '🤸', '🤸‍♂️', '🤸‍♀️', '⛹️', '🏃', '🏃‍♂️',
            '🏃‍♀️', '🚴', '🚴‍♂️', '🚴‍♀️', '🧘', '🧘‍♂️', '🧘‍♀️', '🤾', '🏊', '🏊‍♂️',
            '🏊‍♀️', '🤽', '🚣', '🧗', '🧗‍♂️', '🧗‍♀️', '🏇', '⛷️', '🏂', '🪂',
            '🏆', '🥇', '🥈', '🥉', '🏅', '🎖️', '🔥', '💯', '⚡', '🎯',
            '✅', '🙌', '👊', '✊', '🤜', '🤛', '👍', '🫡', '🦾', '🏃‍➡️',
        ]
    },
    {
        name: 'Food',
        icon: '🍕',
        emojis: [
            '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈',
            '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🫛',
            '🥦', '🥬', '🥒', '🌶️', '🫑', '🌽', '🥕', '🧄', '🧅', '🫘',
            '🥔', '🍠', '🫚', '🥐', '🍞', '🥖', '🥨', '🧀', '🥚', '🍳',
            '🧈', '🥞', '🧇', '🥓', '🥩', '🍗', '🍖', '🌭', '🍔', '🍟',
            '🍕', '🫓', '🥪', '🥙', '🧆', '🌮', '🌯', '🫔', '🥗', '🫕',
            '🍝', '🍜', '🍲', '🍛', '🍣', '🍱', '🥟', '🍤', '🍙', '🍚',
            '🍘', '🍥', '🥮', '🍢', '🍡', '🍧', '🍨', '🍦', '🥧', '🧁',
            '🍰', '🎂', '🍮', '🍭', '🍬', '🍫', '🍿', '🍩', '🍪', '🌰',
        ]
    },
    {
        name: 'Animals',
        icon: '🐶',
        emojis: [
            '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐻‍❄️', '🐨',
            '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒',
            '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉', '🦇',
            '🐺', '🐗', '🐴', '🦄', '🐝', '🪱', '🐛', '🦋', '🐌', '🐞',
            '🐜', '🪰', '🪲', '🪳', '🦟', '🦗', '🕷️', '🦂', '🐢', '🐍',
            '🦎', '🦖', '🦕', '🐙', '🦑', '🦐', '🦞', '🦀', '🐡', '🐠',
            '🐟', '🐬', '🐳', '🐋', '🦈', '🐊', '🐅', '🐆', '🦓', '🦍',
            '🦧', '🦣', '🐘', '🦛', '🦏', '🐪', '🐫', '🦒', '🦘', '🦬',
        ]
    },
    {
        name: 'Objects',
        icon: '⚽',
        emojis: [
            '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱',
            '🪀', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🥅', '⛳', '🪁',
            '🎣', '🤿', '🎽', '🎿', '🛷', '🥌', '🎮', '🕹️', '🎲', '🧩',
            '🎭', '🎨', '🎬', '🎤', '🎧', '🎼', '🎹', '🥁', '🎷', '🎺',
            '🪗', '🎸', '🪕', '🎻', '💊', '🩹', '🩺', '🩻', '🧬', '🔬',
            '🔭', '📡', '💻', '🖥️', '🖨️', '📱', '📲', '☎️', '📞', '💡',
        ]
    },
    {
        name: 'Symbols',
        icon: '💯',
        emojis: [
            '💯', '🔥', '⭐', '🌟', '✨', '⚡', '💥', '💫', '🎉', '🎊',
            '🎈', '🎁', '🎀', '🏷️', '💰', '💵', '💸', '✅', '❌', '❓',
            '❗', '‼️', '⁉️', '💤', '💬', '👁️‍🗨️', '🗨️', '💭', '🔔', '🔕',
            '🎵', '🎶', '🔊', '📢', '📣', '🔈', '🔉', '🔇', '⏰', '⏱️',
            '⏲️', '🕐', '♻️', '✝️', '☪️', '🕉️', '☸️', '✡️', '🔯', '🕎',
            '☯️', '☮️', '🛐', '⛎', '♈', '♉', '♊', '♋', '♌', '♍',
            '♎', '♏', '♐', '♑', '♒', '♓', '🆔', '⚛️', '🆗', '🆕',
        ]
    },
    {
        name: 'Flags',
        icon: '🏁',
        emojis: [
            '🏁', '🚩', '🎌', '🏴', '🏳️', '🏳️‍🌈', '🏳️‍⚧️', '🏴‍☠️',
            '🇺🇸', '🇬🇧', '🇨🇦', '🇦🇺', '🇩🇪', '🇫🇷', '🇮🇹', '🇪🇸',
            '🇧🇷', '🇲🇽', '🇯🇵', '🇰🇷', '🇨🇳', '🇮🇳', '🇷🇺', '🇿🇦',
            '🇳🇬', '🇪🇬', '🇦🇷', '🇨🇴', '🇵🇪', '🇨🇱', '🇻🇪', '🇵🇹',
            '🇳🇱', '🇧🇪', '🇸🇪', '🇳🇴', '🇩🇰', '🇫🇮', '🇮🇪', '🇵🇱',
        ]
    },
];

interface EmojiPickerProps {
    onSelect: (emoji: string) => void;
    onClose: () => void;
    position?: 'above' | 'below';
}

export default function EmojiPicker({ onSelect, onClose, position = 'above' }: EmojiPickerProps) {
    const [activeCategory, setActiveCategory] = useState(0);
    const [search, setSearch] = useState('');
    const pickerRef = useRef<HTMLDivElement>(null);
    const searchRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        searchRef.current?.focus();
    }, []);

    useEffect(() => {
        const handle = (e: MouseEvent | TouchEvent) => {
            if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handle);
        document.addEventListener('touchstart', handle);
        return () => {
            document.removeEventListener('mousedown', handle);
            document.removeEventListener('touchstart', handle);
        };
    }, [onClose]);

    const filteredEmojis = useMemo(() => {
        if (!search) return EMOJI_CATEGORIES[activeCategory].emojis;
        const q = search.toLowerCase().trim();
        if (!q) return EMOJI_CATEGORIES[activeCategory].emojis;
        const terms = q.split(/\s+/).filter(Boolean);
        const allEmojis = EMOJI_CATEGORIES.flatMap(c => c.emojis);
        const uniqueEmojis = [...new Set(allEmojis)];

        // Score each emoji: higher score = better match
        const scored: { emoji: string; score: number }[] = [];
        for (const emoji of uniqueEmojis) {
            const keywords = (EMOJI_KEYWORDS[emoji] || '').toLowerCase();
            const keywordList = keywords.split(/\s+/);
            let score = 0;

            for (const term of terms) {
                // Exact keyword match (word starts with the term)
                const exactMatch = keywordList.some(kw => kw === term);
                const prefixMatch = keywordList.some(kw => kw.startsWith(term));
                const partialMatch = keywords.includes(term);

                // Also check category names
                const categoryMatch = EMOJI_CATEGORIES.some(
                    c => c.name.toLowerCase().includes(term) && c.emojis.includes(emoji)
                );

                if (exactMatch) score += 3;
                else if (prefixMatch) score += 2;
                else if (partialMatch) score += 1;
                if (categoryMatch) score += 1;
            }

            if (score > 0) scored.push({ emoji, score });
        }

        // Sort by score descending for best matches first
        scored.sort((a, b) => b.score - a.score);
        return scored.map(s => s.emoji);
    }, [search, activeCategory]);

    return (
        <div
            ref={pickerRef}
            onClick={e => e.stopPropagation()}
            onTouchStart={e => e.stopPropagation()}
            style={{
                position: 'absolute',
                [position === 'above' ? 'bottom' : 'top']: '100%',
                left: 0,
                right: 0,
                zIndex: 1000,
                background: '#1a1a24',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 16,
                boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                width: 280,
                maxWidth: '90vw',
                animation: 'scaleIn 0.15s ease-out',
                overflow: 'hidden',
            }}
        >
            {/* Search */}
            <div style={{ padding: '8px 8px 4px' }}>
                <input
                    ref={searchRef}
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search emoji..."
                    style={{
                        width: '100%',
                        padding: '6px 10px',
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 8,
                        color: 'var(--foreground)',
                        fontSize: 13,
                        outline: 'none',
                    }}
                />
            </div>

            {/* Category tabs */}
            {!search && (
                <div style={{
                    display: 'flex',
                    overflowX: 'auto',
                    padding: '4px 4px 0',
                    gap: 2,
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    WebkitOverflowScrolling: 'touch',
                    scrollbarWidth: 'none',
                }}>
                    {EMOJI_CATEGORIES.map((cat, i) => (
                        <button
                            key={cat.name}
                            onClick={() => setActiveCategory(i)}
                            style={{
                                fontSize: 16,
                                padding: '4px 6px',
                                background: i === activeCategory ? 'rgba(255,255,255,0.1)' : 'none',
                                border: 'none',
                                borderRadius: 6,
                                cursor: 'pointer',
                                flexShrink: 0,
                                borderBottom: i === activeCategory ? '2px solid var(--primary)' : '2px solid transparent',
                            }}
                            title={cat.name}
                        >
                            {cat.icon}
                        </button>
                    ))}
                </div>
            )}

            {/* Emoji grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                gap: 2,
                padding: 6,
                maxHeight: 220,
                overflowY: 'auto',
                WebkitOverflowScrolling: 'touch',
            }}>
                {filteredEmojis.map((emoji, i) => (
                    <button
                        key={`${emoji}-${i}`}
                        onClick={() => { onSelect(emoji); onClose(); }}
                        style={{
                            fontSize: 22,
                            padding: 4,
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            borderRadius: 6,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            aspectRatio: '1',
                            transition: 'background 0.1s',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                    >
                        {emoji}
                    </button>
                ))}
            </div>
        </div>
    );
}
