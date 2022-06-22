const { WebClient } = require('@slack/web-api');
const JapaneseHolidays = require('japanese-holidays');
const env = process.env;
const username = 'my bot'; // slack bot's username
const header = ">*Today's Attendance*";
const excludeUsers = ['XXXXX'];

(async () => {
  const today = new Date();
  const week = today.getDay();
  if (week == 0 || week == 6) {
    console.log(`today is saturday or sunday`);
    return;
  }
  var holiday = JapaneseHolidays.isHoliday(today);
  if (holiday) {
      console.log(`today is holiday ${holiday}`);
      return;
  }

  const token  = env.slack_token; // OAuth Tokens
  if (token == undefined) {
    console.error('slack_token undefined');
    return;
  }
  const channel = env.slack_channel; // channel id to post
  if (channel == undefined) {
    console.error('slack_channel undefined');
    return;
  }

  const client = new WebClient(token);

  const postMessage = async text => {
    await client.chat.postMessage({ 
      channel: channel, 
      text: text, 
      username: username, // requirement chat:write.customize
      icon_emoji: ':helicopter:'
    });
  }

  try {
    const members = await client.conversations.members({ channel });

    const extractUser = async userId => {
      const user = await client.users.info({ user: userId });
      console.log(`extract start->${userId} ${user.user.real_name}`);

      if (user.user.is_bot) {
        console.log('not target user->' + user.user.real_name)
        return null;
      } else if (excludeUsers.includes(userId)) {
        console.log('exclude user->' + user.user.real_name)
        return null;
      } else {
        return user;
      }
    }
    const userPromises = [];
    for (const memberId of members.members) {
      userPromises.push(extractUser(memberId));
    }

    const userInfos = (await Promise.all(userPromises)).filter(v => v); // pull out null

    const textUser = async (userInfo) => {
      const presence = await client.users.getPresence({ user: userInfo.user.id });
      const profile = await client.users.profile.get({ user: userInfo.user.id });
      let presenceEmoji = ':grey_question:';

      if (presence.presence == 'active') {
        presenceEmoji = ':green_heart:';
      } else if (presence.presence == 'away'){
        presenceEmoji = ':red_circle:';
      } 

      return `${presenceEmoji}\t${userInfo.user.real_name}\t${profile.profile.status_emoji}${profile.profile.status_text}`;
    }
    const textPromises = [];
    for (const userIndo of userInfos) {
      textPromises.push(textUser(userIndo));
    }

    const textUsers = (await Promise.all(textPromises)).sort();

    let text = header + '\n';
    for (const textUser of textUsers) {
      text += '>' + textUser + '\n';
    }

    await postMessage(text);
  } 
  catch (error) {
    console.error(error);
    await postMessage(error);
  }
})();
