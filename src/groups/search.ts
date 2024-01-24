import user from '../user';
import db from '../database';
import { GroupFullObject } from '../types/group';
import { UserObjectFull } from '../types/user';

function groupSearch(Groups) {
    type Options = {
        sort: string;
        filterHidden: boolean;
        showMembers: boolean;
        hideEphemeralGroups: boolean;
    }
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    Groups.search = async function (query, options: Options) {
        if (!query) {
            return [];
        }
        query = String(query).toLowerCase();
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        let groupNames: string[] = await db.getSortedSetRange('groups:createtime', 0, -1) as string[];
        if (!options.hideEphemeralGroups) {
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            groupNames = Groups.ephemeralGroups.concat(groupNames) as string[];
        }
        groupNames = groupNames.filter(name => name.toLowerCase().includes(query as string) &&
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            name !== Groups.BANNED_USERS && // hide banned-users in searches
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            !Groups.isPrivilegeGroup(name));
        groupNames = groupNames.slice(0, 100);

        let groupsData: GroupFullObject[];
        if (options.showMembers) {
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            groupsData = await Groups.getGroupsAndMembers(groupNames) as GroupFullObject[];
        } else {
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            groupsData = await Groups.getGroupsData(groupNames) as GroupFullObject[];
        }
        groupsData = groupsData.filter(Boolean);
        if (options.filterHidden) {
            groupsData = groupsData.filter(group => !group.hidden);
        }
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        return Groups.sort(options.sort, groupsData) as GroupFullObject[];
    };

    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    Groups.sort = function (strategy: string, groups: GroupFullObject[]) {
        switch (strategy) {
        case 'count':
            groups.sort((a, b) => (a.slug > b.slug ? -1 : 1))
                .sort((a, b) => b.memberCount - a.memberCount);
            break;

        case 'date':
            groups.sort((a, b) => b.createtime - a.createtime);
            break;

        case 'alpha': // intentional fall-through
        default:
            groups.sort((a, b) => (a.slug > b.slug ? 1 : -1));
        }

        return groups;
    };

    type Data = {
        query: string | number | string[] | undefined;
        groupName: string;
        uid: number;
    }
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    Groups.searchMembers = async function (data: Data) {
        type NewUserObject = UserObjectFull & {isOwner: boolean};
        type UserArray = NewUserObject[];
        if (!data.query) {
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            const users: UserArray = await Groups.getOwnersAndMembers(data.groupName, data.uid, 0, 19) as UserArray;
            return { users: users };
        }

        type SearchResult = {
            matchCount: number;
            timing: string;
            users: UserArray;
        }

        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const results: SearchResult = await user.search({
            ...data,
            paginate: false,
            hardCap: -1,
        }) as SearchResult;

        const uids = results.users.map(user => user && user.uid);

        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const isOwners: boolean[] = await Groups.ownership.isOwners(uids, data.groupName) as boolean[];

        results.users.forEach((user, index) => {
            if (user) {
                user.isOwner = isOwners[index];
            }
        });

        results.users.sort((a, b) => {
            if (a.isOwner && !b.isOwner) {
                return -1;
            } else if (!a.isOwner && b.isOwner) {
                return 1;
            }
            return 0;
        });
        return results;
    };
}
export = groupSearch;
