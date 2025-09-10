// Accessibility utilities

export function getAriaLabelForBattleStatus(status: string): string {
  switch (status) {
    case "pending":
      return "Battle is pending - waiting for participants to accept";
    case "active":
      return "Battle is active - voting is open";
    case "expired":
      return "Battle has expired - voting is closed";
    default:
      return "Battle status unknown";
  }
}

export function getAriaLabelForVoteButton(hasVoted: boolean, isActive: boolean): string {
  if (!isActive) {
    return "Voting is not available for this battle";
  }
  return hasVoted ? "You have already voted" : "Click to vote for this participant";
}

export function getAriaLabelForParticipant(participant: any, isLeading: boolean, isVoted: boolean): string {
  const username = participant.user?.username || "Unknown user";
  const voteCount = participant.participant?.voteCount || 0;
  const percentage = participant.participant?.votePercentage || 0;
  
  let label = `Participant ${username} with ${voteCount} votes (${percentage}%)`;
  
  if (isLeading) {
    label += " - currently leading";
  }
  
  if (isVoted) {
    label += " - you voted for this participant";
  }
  
  return label;
}

export function getAriaLabelForTimeLeft(timeLeft: string | null): string {
  if (!timeLeft) {
    return "No time limit for this battle";
  }
  return `Time remaining: ${timeLeft}`;
}

export function getAriaLabelForNotificationCount(count: number): string {
  if (count === 0) {
    return "No new notifications";
  }
  if (count === 1) {
    return "1 new notification";
  }
  return `${count} new notifications`;
}

export function getAriaLabelForUserStats(stats: any): string {
  const posts = stats.postsCount || 0;
  const battles = stats.battlesCount || 0;
  const followers = stats.followersCount || 0;
  const following = stats.followingCount || 0;
  const winRate = stats.winRate || 0;
  
  return `User statistics: ${posts} posts, ${battles} battles, ${followers} followers, ${following} following, ${winRate}% win rate`;
}

export function getAriaLabelForTab(tabName: string, isActive: boolean): string {
  const labels: Record<string, string> = {
    home: "Home feed",
    ranking: "User rankings",
    create: "Create new battle",
    chats: "Messages",
    profile: "User profile"
  };
  
  const baseLabel = labels[tabName] || tabName;
  return isActive ? `${baseLabel} - currently selected` : baseLabel;
}

export function getAriaLabelForButton(buttonType: string, isDisabled: boolean = false): string {
  const labels: Record<string, string> = {
    vote: "Vote for this participant",
    feedback: "Send feedback",
    share: "Share this battle",
    like: "Like this post",
    follow: "Follow this user",
    unfollow: "Unfollow this user",
    edit: "Edit",
    delete: "Delete",
    close: "Close",
    back: "Go back",
    send: "Send message",
    search: "Search",
    filter: "Filter results",
    sort: "Sort results"
  };
  
  const baseLabel = labels[buttonType] || buttonType;
  return isDisabled ? `${baseLabel} - currently disabled` : baseLabel;
}

export function getAriaLabelForInput(inputType: string, placeholder?: string): string {
  const labels: Record<string, string> = {
    search: "Search",
    message: "Type your message",
    comment: "Add a comment",
    title: "Enter title",
    bio: "Enter bio",
    link: "Enter URL"
  };
  
  const baseLabel = labels[inputType] || inputType;
  return placeholder ? `${baseLabel}: ${placeholder}` : baseLabel;
}

export function getAriaLabelForImage(alt: string, context?: string): string {
  if (alt) {
    return alt;
  }
  
  if (context) {
    return `${context} image`;
  }
  
  return "Image";
}

export function getAriaLabelForProgress(current: number, total: number): string {
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
  return `Progress: ${current} of ${total} (${percentage}%)`;
}

export function getAriaLabelForVoteMeter(participant: any): string {
  const username = participant.user?.username || "Unknown user";
  const percentage = participant.participant?.votePercentage || 0;
  const voteCount = participant.participant?.voteCount || 0;
  
  return `${username}: ${percentage}% (${voteCount} votes)`;
}

