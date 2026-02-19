/**
 * APIs Page
 *
 * Full-page view for API endpoint management:
 * - Center: ApiList (CRUD for REST endpoints)
 */

import React from "react";
import ApiList from "../Canvas/DataCanvas/ApiList";

const APIsPage: React.FC = () => {
    return (
        <div className="flex flex-1 overflow-hidden h-full">
            <main className="flex-1 overflow-hidden">
                <ApiList />
            </main>
        </div>
    );
};

export default APIsPage;
